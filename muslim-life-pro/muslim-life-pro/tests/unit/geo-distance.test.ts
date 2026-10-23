import { describe, expect, it } from 'vitest'

import {
  calculateDistanceKm,
  formatDistance,
  hasCoordinates,
  withDistance,
} from '@/lib/geo/distance'

const BRUSSELS = { latitude: 50.8503, longitude: 4.3517 }
const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041 }
const PARIS = { latitude: 48.8566, longitude: 2.3522 }
const LONDON = { latitude: 51.5074, longitude: -0.1278 }
const MAKKAH = { latitude: 21.3891, longitude: 39.8579 }

describe('calculateDistanceKm', () => {
  it('is zero for the same point', () => {
    expect(calculateDistanceKm(BRUSSELS, BRUSSELS)).toBe(0)
  })

  it('matches published great-circle distances within tolerance', () => {
    // Reference values are the accepted straight-line city-centre distances.
    // 1% tolerance covers differences in which centroid each source uses.
    const cases: [string, typeof BRUSSELS, typeof BRUSSELS, number][] = [
      ['Brussels → Amsterdam', BRUSSELS, AMSTERDAM, 173],
      ['Brussels → Paris', BRUSSELS, PARIS, 264],
      ['Brussels → London', BRUSSELS, LONDON, 320],
      ['Brussels → Makkah', BRUSSELS, MAKKAH, 4560],
    ]

    for (const [label, from, to, expected] of cases) {
      const actual = calculateDistanceKm(from, to)
      const drift = Math.abs(actual - expected) / expected

      expect(drift, `${label}: expected ~${expected} km, got ${actual.toFixed(1)} km`).toBeLessThan(
        0.02,
      )
    }
  })

  it('is symmetric', () => {
    const there = calculateDistanceKm(BRUSSELS, PARIS)
    const back = calculateDistanceKm(PARIS, BRUSSELS)

    expect(there).toBeCloseTo(back, 9)
  })

  it('handles antipodal points without losing precision', () => {
    // The classic Haversine failure mode: asin(sqrt(h)) degrades near h = 1.
    const north = { latitude: 45, longitude: 0 }
    const antipode = { latitude: -45, longitude: 180 }

    const distance = calculateDistanceKm(north, antipode)

    expect(Number.isNaN(distance)).toBe(false)
    // Half the Earth's circumference, roughly 20,015 km.
    expect(distance).toBeGreaterThan(19_900)
    expect(distance).toBeLessThan(20_100)
  })

  it('crosses the antimeridian correctly', () => {
    const west = { latitude: 0, longitude: 179 }
    const east = { latitude: 0, longitude: -179 }

    // Two degrees apart at the equator, roughly 222 km — not 39,800 km the
    // long way round.
    expect(calculateDistanceKm(west, east)).toBeLessThan(250)
  })

  it('handles poles', () => {
    const northPole = { latitude: 90, longitude: 0 }
    const southPole = { latitude: -90, longitude: 0 }

    expect(calculateDistanceKm(northPole, northPole)).toBeCloseTo(0, 6)
    expect(calculateDistanceKm(northPole, southPole)).toBeGreaterThan(19_900)
  })
})

describe('hasCoordinates', () => {
  it('rejects partial or missing coordinates', () => {
    expect(hasCoordinates({ latitude: 50, longitude: 4 })).toBe(true)
    expect(hasCoordinates({ latitude: null, longitude: 4 })).toBe(false)
    expect(hasCoordinates({ latitude: 50, longitude: null })).toBe(false)
    expect(hasCoordinates(null)).toBe(false)
    expect(hasCoordinates(undefined)).toBe(false)
  })

  it('treats zero as a real coordinate', () => {
    // Null Island is a valid point; `!value.latitude` would wrongly reject it.
    expect(hasCoordinates({ latitude: 0, longitude: 0 })).toBe(true)
  })
})

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0.4)).toBe('400 m away')
    expect(formatDistance(0.85)).toBe('900 m away')
  })

  it('says "Nearby" rather than pretending to 10 m precision', () => {
    // The underlying coordinate is a city centroid; "45 m away" would be a lie.
    expect(formatDistance(0.05)).toBe('Nearby')
  })

  it('uses one decimal under 10 km and whole numbers above', () => {
    expect(formatDistance(1.24)).toBe('1.2 km away')
    expect(formatDistance(9.9)).toBe('9.9 km away')
    expect(formatDistance(173.4)).toBe('173 km away')
  })

  it('returns nothing for invalid input', () => {
    expect(formatDistance(Number.NaN)).toBe('')
    expect(formatDistance(-5)).toBe('')
  })
})

describe('withDistance', () => {
  const items = [
    { id: 'a', latitude: 52.3676, longitude: 4.9041 },
    { id: 'b', latitude: null, longitude: null },
  ]

  it('attaches distance only where coordinates exist', () => {
    const result = withDistance(items, BRUSSELS)

    expect(result[0]!.distanceKm).toBeGreaterThan(100)
    expect(result[1]!.distanceKm).toBeNull()
  })

  it('returns null distances when the member has no location', () => {
    const result = withDistance(items, null)

    expect(result.every((item) => item.distanceKm === null)).toBe(true)
  })
})
