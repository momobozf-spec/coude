import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { stationsResponseSchema, type StationInfo } from '@/lib/irail/schemas'
import { findStationById, normaliseForSearch, searchStations } from '@/lib/irail/stations'

const stations: StationInfo[] = stationsResponseSchema.parse(
  JSON.parse(
    readFileSync(
      join(process.cwd(), 'tests', 'fixtures', 'irail', 'stations-subset.json'),
      'utf8',
    ),
  ),
).station

const ids = (query: string) => searchStations(stations, query).map((m) => m.id)

const BRUSSEL_ZUID = 'BE.NMBS.008814001'
const GENT_SINT_PIETERS = 'BE.NMBS.008892007'
const LUIK_GUILLEMINS = 'BE.NMBS.008841004'

describe('normaliseForSearch', () => {
  it('strips accents so Liege matches Liège', () => {
    expect(normaliseForSearch('Liège')).toBe('liege')
  })

  it('treats hyphens and slashes as spaces', () => {
    expect(normaliseForSearch('Gent-Sint-Pieters')).toBe('gent sint pieters')
    expect(normaliseForSearch('Brussel-Zuid/Bruxelles-Midi')).toBe(
      'brussel zuid bruxelles midi',
    )
  })

  it('drops apostrophes', () => {
    expect(normaliseForSearch("'s Gravenbrakel")).toBe('s gravenbrakel')
  })
})

describe('bilingual station search', () => {
  it('finds Brussel-Zuid by its Dutch name', () => {
    expect(ids('brussel')).toContain(BRUSSEL_ZUID)
  })

  it('finds the same station by its French name', () => {
    // The commuter types "Bruxelles-Midi"; iRail only gave us "Brussel-Zuid"
    // as the localised name, with the French half inside standardname.
    expect(ids('bruxelles')).toContain(BRUSSEL_ZUID)
    expect(ids('midi')).toContain(BRUSSEL_ZUID)
  })

  it('finds Luik-Guillemins by the French Liège', () => {
    expect(ids('liege')).toContain(LUIK_GUILLEMINS)
    expect(ids('Liège')).toContain(LUIK_GUILLEMINS)
  })

  it('matches on a later word, not just the first', () => {
    expect(ids('pieters')).toContain(GENT_SINT_PIETERS)
  })

  it('tolerates spaces where the official name has hyphens', () => {
    expect(ids('gent sint pieters')).toContain(GENT_SINT_PIETERS)
  })

  it('is case-insensitive', () => {
    expect(ids('GENT')).toContain(GENT_SINT_PIETERS)
  })

  it('ranks an exact match first', () => {
    const results = searchStations(stations, 'Gent-Sint-Pieters')
    expect(results[0].id).toBe(GENT_SINT_PIETERS)
  })

  it('returns nothing for a query that is too short to be useful', () => {
    expect(searchStations(stations, 'g')).toEqual([])
    expect(searchStations(stations, '')).toEqual([])
  })

  it('returns nothing for a station that does not exist', () => {
    expect(searchStations(stations, 'zzzznotastation')).toEqual([])
  })

  it('respects the result limit', () => {
    expect(searchStations(stations, 'e', 3).length).toBeLessThanOrEqual(3)
  })

  it('exposes the bilingual name only when it adds information', () => {
    const brussels = searchStations(stations, 'brussel').find(
      (m) => m.id === BRUSSEL_ZUID,
    )
    expect(brussels?.standardName).toBe('Brussel-Zuid/Bruxelles-Midi')

    const gent = searchStations(stations, 'gent sint').find(
      (m) => m.id === GENT_SINT_PIETERS,
    )
    // Name and standardname are identical here, so there is nothing to add.
    expect(gent?.standardName).toBeNull()
  })
})

describe('findStationById', () => {
  it('resolves a saved route back to a station', () => {
    expect(findStationById(stations, GENT_SINT_PIETERS)?.name).toBe('Gent-Sint-Pieters')
  })

  it('returns null for an unknown id', () => {
    expect(findStationById(stations, 'BE.NMBS.000000000')).toBeNull()
  })
})
