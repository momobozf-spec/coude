import { describe, expect, it } from 'vitest'

import {
  FRESHNESS_WEIGHTS,
  assessFreshness,
  monthsBetween,
} from '@/server/modules/charities/transparency/freshness'

/**
 * Evidence freshness (§10, §24).
 *
 * The rule these tests protect: a 2022 document and a 2026 document must never
 * be presented as equally current, and nothing is ever discarded for being old.
 */

const NOW = new Date('2026-08-08T00:00:00.000Z')

describe('monthsBetween', () => {
  it('counts whole months', () => {
    expect(monthsBetween(new Date('2026-01-08T00:00:00Z'), NOW)).toBe(7)
    expect(monthsBetween(new Date('2025-08-08T00:00:00Z'), NOW)).toBe(12)
  })

  it('does not round a partial month up', () => {
    // 8 July to 8 August is one month; 9 July to 8 August is not yet.
    expect(monthsBetween(new Date('2026-07-08T00:00:00Z'), NOW)).toBe(1)
    expect(monthsBetween(new Date('2026-07-09T00:00:00Z'), NOW)).toBe(0)
  })

  it('crosses year boundaries', () => {
    expect(monthsBetween(new Date('2022-01-01T00:00:00Z'), NOW)).toBe(55)
  })
})

describe('fresh evidence', () => {
  it('is FRESH inside the window', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2026-01-01T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.state).toBe('FRESH')
    expect(result.ageMonths).toBe(7)
  })

  it('is FRESH exactly at the boundary', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2024-08-08T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.ageMonths).toBe(24)
    expect(result.state).toBe('FRESH')
  })
})

describe('ageing evidence', () => {
  it('becomes STALE one month past the window', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2024-07-08T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.state).toBe('STALE')
    expect(result.reason).toContain('verouderd')
  })

  it('becomes EXPIRED past twice the window', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2022-01-01T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.state).toBe('EXPIRED')
    expect(result.reason).toContain('verlopen')
  })

  it('describes the age in readable terms', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2022-01-01T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.reason).toContain('jaar')
  })
})

describe('date selection', () => {
  it('prefers the document date over the retrieval date', () => {
    // Fetching a 2021 report yesterday does not make it recent evidence.
    const result = assessFreshness(
      {
        publishedAt: new Date('2021-01-01T00:00:00Z'),
        retrievedAt: new Date('2026-08-01T00:00:00Z'),
        freshnessMonths: 24,
      },
      NOW,
    )

    expect(result.state).toBe('EXPIRED')
    expect(result.measuredFrom).toEqual(new Date('2021-01-01T00:00:00Z'))
  })

  it('falls back to the retrieval date when the document has none', () => {
    const result = assessFreshness(
      { retrievedAt: new Date('2026-06-01T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.state).toBe('FRESH')
    expect(result.measuredFrom).toEqual(new Date('2026-06-01T00:00:00Z'))
  })

  it('reports UNKNOWN with no date at all', () => {
    const result = assessFreshness({ freshnessMonths: 24 }, NOW)

    expect(result.state).toBe('UNKNOWN')
    expect(result.ageMonths).toBeNull()
  })

  it('treats a future date as unusable rather than fresh', () => {
    const result = assessFreshness(
      { publishedAt: new Date('2030-01-01T00:00:00Z'), freshnessMonths: 24 },
      NOW,
    )

    expect(result.state).toBe('UNKNOWN')
    expect(result.reason).toContain('toekomst')
  })
})

describe('explicit validity', () => {
  it('honours a validUntil in the past over any other signal', () => {
    const result = assessFreshness(
      {
        publishedAt: new Date('2026-07-01T00:00:00Z'),
        retrievedAt: NOW,
        validUntil: new Date('2026-08-01T00:00:00Z'),
        freshnessMonths: 24,
      },
      NOW,
    )

    // The document says it stopped being valid; that beats a recent date.
    expect(result.state).toBe('EXPIRED')
  })

  it('ignores a validUntil still in the future', () => {
    const result = assessFreshness(
      {
        publishedAt: new Date('2026-07-01T00:00:00Z'),
        validUntil: new Date('2027-01-01T00:00:00Z'),
        freshnessMonths: 24,
      },
      NOW,
    )

    expect(result.state).toBe('FRESH')
  })
})

describe('per-type windows', () => {
  it('lets a long-lived registration stay fresh where a report would not', () => {
    const published = new Date('2023-01-01T00:00:00Z')

    const registration = assessFreshness({ publishedAt: published, freshnessMonths: 60 }, NOW)
    const report = assessFreshness({ publishedAt: published, freshnessMonths: 24 }, NOW)

    expect(registration.state).toBe('FRESH')
    expect(report.state).toBe('STALE')
  })
})

describe('weights', () => {
  it('ranks fresh above stale above expired', () => {
    expect(FRESHNESS_WEIGHTS.FRESH).toBeGreaterThan(FRESHNESS_WEIGHTS.STALE)
    expect(FRESHNESS_WEIGHTS.STALE).toBeGreaterThan(FRESHNESS_WEIGHTS.EXPIRED)
  })

  it('never zeroes expired evidence entirely', () => {
    // Expired evidence still shows the information once existed.
    expect(FRESHNESS_WEIGHTS.EXPIRED).toBeGreaterThan(0)
  })
})
