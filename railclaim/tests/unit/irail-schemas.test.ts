import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  connectionsResponseSchema,
  findStopByStationId,
  resolveFinalLegVehicle,
  secondsToDelayMinutes,
  stationsResponseSchema,
  vehicleResponseSchema,
} from '@/lib/irail/schemas'

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'irail')

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'))
}

const GENT_SINT_PIETERS = 'BE.NMBS.008892007'
const OOSTENDE = 'BE.NMBS.008891702'

describe('secondsToDelayMinutes — the seconds/minutes trap', () => {
  it('treats iRail delay as SECONDS, not minutes', () => {
    // 3600 seconds is a 60-minute delay. Reading it as minutes would invent
    // a 60-hour delay and auto-generate a bogus 100% claim.
    expect(secondsToDelayMinutes(3600)).toBe(60)
    expect(secondsToDelayMinutes(1800)).toBe(30)
  })

  it('clamps a negative delay (train ahead of schedule) to zero', () => {
    // "-60" was observed live: one minute early.
    expect(secondsToDelayMinutes(-60)).toBe(0)
    expect(secondsToDelayMinutes(-3600)).toBe(0)
  })

  it('truncates rather than rounding up across a threshold', () => {
    // 59 min 59 s must stay 59 — never round up into a 60-minute claim.
    expect(secondsToDelayMinutes(3599)).toBe(59)
    expect(secondsToDelayMinutes(1799)).toBe(29)
  })

  it('handles zero and non-finite input safely', () => {
    expect(secondsToDelayMinutes(0)).toBe(0)
    expect(secondsToDelayMinutes(Number.NaN)).toBe(0)
  })
})

describe('stations fixture', () => {
  it('parses and exposes stable ids', () => {
    const parsed = stationsResponseSchema.parse(fixture('stations-subset.json'))
    const gent = parsed.station.find((s) => s.id === GENT_SINT_PIETERS)
    expect(gent?.name).toBe('Gent-Sint-Pieters')
  })

  it('keeps the bilingual standardname for search', () => {
    const parsed = stationsResponseSchema.parse(fixture('stations-subset.json'))
    const brussels = parsed.station.find((s) => s.id === 'BE.NMBS.008814001')
    expect(brussels?.standardname).toBe('Brussel-Zuid/Bruxelles-Midi')
  })
})

describe('connections fixture (direct journey)', () => {
  const parsed = connectionsResponseSchema.parse(fixture('connections-direct.json'))
  const connection = parsed.connection[0]

  it('coerces string booleans and timestamps', () => {
    expect(typeof connection.departure.canceled).toBe('boolean')
    expect(connection.departure.time).toBeInstanceOf(Date)
  })

  it('keeps delay in seconds, preserving the negative value', () => {
    // Observed live: arrival delay "-60" (one minute early).
    expect(connection.arrival.delay).toBe(-60)
    expect(secondsToDelayMinutes(connection.arrival.delay)).toBe(0)
  })

  it('resolves the final-leg vehicle to the only train when there is no transfer', () => {
    const vehicle = resolveFinalLegVehicle(connection)
    expect(vehicle?.number).toBe('527')
    expect(vehicle?.name).toBe('BE.NMBS.IC527')
  })
})

describe('connections fixture (with transfer)', () => {
  const parsed = connectionsResponseSchema.parse(fixture('connections-with-via.json'))
  const withVia = parsed.connection.find((c) => c.vias)

  it('has a via', () => {
    expect(withVia).toBeDefined()
    expect(withVia!.vias!.via.length).toBeGreaterThan(0)
  })

  it('resolves the final leg to the LAST via departure, not the first leg', () => {
    const first = withVia!.departure.vehicleinfo
    const final = resolveFinalLegVehicle(withVia!)
    const lastVia = withVia!.vias!.via[withVia!.vias!.via.length - 1]

    expect(final?.name).toBe(lastVia.departure.vehicleinfo?.name)
    // Using the first leg's train would query the wrong train entirely.
    expect(final?.name).not.toBe(first?.name)
  })
})

describe('vehicle fixture — the arrival-delay source', () => {
  const parsed = vehicleResponseSchema.parse(fixture('vehicle-ic527.json'))

  it('exposes per-stop arrival delay and cancellation', () => {
    const stop = parsed.stops.stop[0]
    expect(stop).toHaveProperty('arrivalDelay')
    expect(stop).toHaveProperty('arrivalCanceled')
    expect(typeof stop.arrivalCanceled).toBe('boolean')
  })

  it('finds a stop by station id rather than by index', () => {
    const stop = findStopByStationId(parsed.stops.stop, OOSTENDE)
    expect(stop?.station).toBe('Oostende')
  })

  it('returns null for a station the train does not serve', () => {
    expect(findStopByStationId(parsed.stops.stop, 'BE.NMBS.000000000')).toBeNull()
  })

  it('carries the scheduled arrival time we measure against', () => {
    const stop = findStopByStationId(parsed.stops.stop, OOSTENDE)
    expect(stop?.scheduledArrivalTime).toBeInstanceOf(Date)
  })
})
