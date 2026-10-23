import { describe, expect, it } from 'vitest'

import {
  addDays,
  diffInDays,
  endOfMonth,
  endOfWeek,
  formatDuration,
  isoDateToUtcDate,
  lastNDays,
  monthKey,
  safeTimezone,
  startOfMonth,
  startOfWeek,
  timeOfDayIn,
  toIsoDateIn,
  utcDateToIsoDate,
} from '@/lib/dates'

describe('calendar day resolution', () => {
  it('resolves the local day, not the UTC day, late at night', () => {
    // 22:50 UTC on 14 March is already 15 March in Dubai (UTC+4). This is the
    // bug class the whole module exists to prevent: an Isha tick landing on the
    // wrong day.
    const instant = new Date('2026-03-14T22:50:00.000Z')

    expect(toIsoDateIn(instant, 'Asia/Dubai')).toBe('2026-03-15')
    expect(toIsoDateIn(instant, 'Europe/Brussels')).toBe('2026-03-14')
    expect(toIsoDateIn(instant, 'America/New_York')).toBe('2026-03-14')
  })

  it('round-trips between ISO dates and UTC-midnight Dates', () => {
    const date = '2026-08-07'
    expect(utcDateToIsoDate(isoDateToUtcDate(date))).toBe(date)
    expect(isoDateToUtcDate(date).toISOString()).toBe('2026-08-07T00:00:00.000Z')
  })

  it('falls back for an invalid timezone rather than throwing', () => {
    expect(safeTimezone('Not/AZone')).toBe('Europe/Brussels')
    expect(safeTimezone(null)).toBe('Europe/Brussels')
    expect(safeTimezone('Asia/Dubai')).toBe('Asia/Dubai')
  })
})

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles a leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('measures the difference in days', () => {
    expect(diffInDays('2026-03-01', '2026-03-15')).toBe(14)
    expect(diffInDays('2026-03-15', '2026-03-01')).toBe(-14)
  })

  it('crosses a DST boundary without drifting', () => {
    // Europe switches to summer time on 29 March 2026. Because days are stored as
    // UTC-midnight dates, arithmetic must be unaffected.
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31')
    expect(diffInDays('2026-03-28', '2026-03-31')).toBe(3)
  })
})

describe('week and month boundaries', () => {
  it('starts the week on Monday by default', () => {
    // 2026-08-07 is a Friday.
    expect(startOfWeek('2026-08-07')).toBe('2026-08-03')
    expect(endOfWeek('2026-08-07')).toBe('2026-08-09')
  })

  it('supports a Sunday week start', () => {
    expect(startOfWeek('2026-08-07', 0)).toBe('2026-08-02')
    expect(endOfWeek('2026-08-07', 0)).toBe('2026-08-08')
  })

  it('finds month boundaries, including February', () => {
    expect(startOfMonth('2026-08-07')).toBe('2026-08-01')
    expect(endOfMonth('2026-08-07')).toBe('2026-08-31')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('returns the last N days inclusive of today', () => {
    const days = lastNDays('2026-08-07', 7)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-08-01')
    expect(days[6]).toBe('2026-08-07')
  })

  it('builds the month key used by AI quotas', () => {
    expect(monthKey('2026-08-07')).toBe('2026-08')
  })
})

describe('formatting', () => {
  it('formats a countdown', () => {
    expect(formatDuration(0)).toBe('now')
    expect(formatDuration(-1000)).toBe('now')
    expect(formatDuration(12 * 60_000)).toBe('12m')
    expect(formatDuration(81 * 60_000)).toBe('1h 21m')
    expect(formatDuration(120 * 60_000)).toBe('2h 0m')
  })

  it('buckets the time of day in the user timezone', () => {
    const morning = new Date('2026-08-07T07:00:00.000Z')
    expect(timeOfDayIn('Europe/Brussels', morning)).toBe('morning')

    // The same instant is 19:00 in Auckland (UTC+12 in August).
    expect(timeOfDayIn('Pacific/Auckland', morning)).toBe('evening')

    // And genuinely night in Los Angeles (00:00 PDT).
    expect(timeOfDayIn('America/Los_Angeles', morning)).toBe('night')
  })
})
