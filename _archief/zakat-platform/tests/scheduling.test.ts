import { describe, expect, it } from 'vitest'

import {
  InvalidTimezoneError,
  fromWallClock,
  instantForLocalDate,
  isValidTimezone,
  offsetMinutesAt,
  parseLocalTime,
  toWallClock,
} from '@/server/modules/reminders/timezone'
import {
  calculateNextOccurrence,
  occurrenceKey,
} from '@/server/modules/reminders/scheduling'

/**
 * Scheduling (§43).
 *
 * Every test pins an explicit "now" — nothing here reads the real clock, so the
 * suite gives the same answer in July as in December and on any CI machine (§55).
 *
 * The behaviours under test are the ones that quietly break in production:
 * DST in both directions, month-end, and leap day.
 */

const BRUSSELS = 'Europe/Brussels'

/** Read an instant back as a local wall-clock string, for readable assertions. */
function local(instant: Date, timezone = BRUSSELS): string {
  const w = toWallClock(instant, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`
}

describe('timezone validation', () => {
  it('accepts an IANA zone', () => {
    expect(isValidTimezone(BRUSSELS)).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
  })

  it('rejects a fixed offset masquerading as a zone', () => {
    // "UTC+2" cannot survive DST, which is the whole reason we store IANA names.
    expect(isValidTimezone('UTC+2')).toBe(false)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
  })

  it('parses a wall time', () => {
    expect(parseLocalTime('09:00')).toEqual({ hour: 9, minute: 0 })
    expect(parseLocalTime('23:59')).toEqual({ hour: 23, minute: 59 })
  })

  it('rejects a malformed wall time', () => {
    expect(() => parseLocalTime('9:00')).toThrow(InvalidTimezoneError)
    expect(() => parseLocalTime('24:00')).toThrow(InvalidTimezoneError)
    expect(() => parseLocalTime('nine')).toThrow(InvalidTimezoneError)
  })
})

describe('offsets follow real DST rules', () => {
  it('reports +60 in winter and +120 in summer for Brussels', () => {
    expect(offsetMinutesAt(new Date('2026-01-15T12:00:00Z'), BRUSSELS)).toBe(60)
    expect(offsetMinutesAt(new Date('2026-07-15T12:00:00Z'), BRUSSELS)).toBe(120)
  })
})

describe('wall clock ↔ instant', () => {
  it('round-trips outside a transition', () => {
    const wall = { year: 2026, month: 6, day: 15, hour: 9, minute: 0 }
    expect(local(fromWallClock(wall, BRUSSELS))).toBe('2026-06-15 09:00')
  })

  it('resolves 09:00 to a different UTC instant in winter and summer', () => {
    const winter = fromWallClock({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, BRUSSELS)
    const summer = fromWallClock({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 }, BRUSSELS)

    // Same wall time, one hour apart in UTC. That is the point.
    expect(winter.toISOString()).toContain('T08:00')
    expect(summer.toISOString()).toContain('T07:00')
  })

  it('pushes a spring-forward gap time to the first instant that exists', () => {
    // 29 March 2026: Brussels jumps 02:00 → 03:00. 02:30 never happens.
    const resolved = fromWallClock({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, BRUSSELS)

    expect(local(resolved)).toBe('2026-03-29 03:00')
  })

  it('picks the earlier instant for an ambiguous fall-back time', () => {
    // 25 October 2026: 03:00 → 02:00, so 02:30 occurs twice.
    const resolved = fromWallClock(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
      BRUSSELS,
    )

    // The earlier one is still CEST (+2), i.e. 00:30 UTC.
    expect(resolved.toISOString()).toContain('T00:30')
    expect(local(resolved)).toBe('2026-10-25 02:30')
  })
})

describe('instantForLocalDate clamps the day', () => {
  it('clamps 31 February to the end of the month', () => {
    expect(local(instantForLocalDate(2026, 2, 31, '09:00', BRUSSELS))).toBe('2026-02-28 09:00')
  })

  it('clamps 31 April to the 30th', () => {
    expect(local(instantForLocalDate(2026, 4, 31, '09:00', BRUSSELS))).toBe('2026-04-30 09:00')
  })
})

// ── Recurrence ───────────────────────────────────────────────────────────────

const base = {
  timezone: BRUSSELS,
  localTime: '09:00',
  endAt: null,
}

describe('one-time reminders', () => {
  it('returns the start when it is still ahead', () => {
    const startAt = new Date('2026-06-15T07:00:00Z')

    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'ONE_TIME',
      startAt,
      after: new Date('2026-06-01T00:00:00Z'),
    })

    expect(next).toEqual(startAt)
  })

  it('returns null once it has passed', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'ONE_TIME',
      startAt: new Date('2026-06-15T07:00:00Z'),
      after: new Date('2026-06-16T00:00:00Z'),
    })

    expect(next).toBeNull()
  })
})

describe('daily reminders', () => {
  it('gives the next day at the same wall time', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'DAILY',
      startAt: new Date('2026-06-01T07:00:00Z'),
      after: new Date('2026-06-15T08:00:00Z'),
    })

    expect(local(next!)).toBe('2026-06-16 09:00')
  })

  it('keeps 09:00 local across the spring-forward boundary', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'DAILY',
      startAt: new Date('2026-03-01T08:00:00Z'),
      // 28 March 10:00 local, the day before the clocks change.
      after: new Date('2026-03-28T09:00:00Z'),
    })

    // Still 09:00 local, even though the UTC instant shifted by an hour.
    expect(local(next!)).toBe('2026-03-29 09:00')
    expect(next!.toISOString()).toContain('T07:00')
  })

  it('keeps 09:00 local across the fall-back boundary', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'DAILY',
      startAt: new Date('2026-10-01T07:00:00Z'),
      after: new Date('2026-10-24T08:00:00Z'),
    })

    expect(local(next!)).toBe('2026-10-25 09:00')
    expect(next!.toISOString()).toContain('T08:00')
  })
})

describe('weekly reminders', () => {
  it('advances seven days at a time', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'WEEKLY',
      startAt: new Date('2026-06-01T07:00:00Z'),
      after: new Date('2026-06-10T00:00:00Z'),
    })

    expect(local(next!)).toBe('2026-06-15 09:00')
  })

  it('stays on the same weekday across DST', () => {
    const start = new Date('2026-03-01T08:00:00Z') // Sunday 09:00 local
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'WEEKLY',
      startAt: start,
      after: new Date('2026-03-28T00:00:00Z'),
    })

    expect(local(next!)).toBe('2026-03-29 09:00')
  })
})

describe('monthly reminders', () => {
  it('advances a month', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'MONTHLY',
      startAt: new Date('2026-01-15T08:00:00Z'),
      after: new Date('2026-01-20T00:00:00Z'),
    })

    expect(local(next!)).toBe('2026-02-15 09:00')
  })

  it('clamps a 31st anchor to the end of February', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'MONTHLY',
      startAt: new Date('2026-01-31T08:00:00Z'),
      after: new Date('2026-02-01T00:00:00Z'),
    })

    // Clamped, not skipped and not rolled into March.
    expect(local(next!)).toBe('2026-02-28 09:00')
  })

  it('returns to the 31st in a month that has one', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'MONTHLY',
      startAt: new Date('2026-01-31T08:00:00Z'),
      after: new Date('2026-03-01T00:00:00Z'),
      anchorDay: 31,
    })

    // A February clamp must not permanently shorten the series.
    expect(local(next!)).toBe('2026-03-31 09:00')
  })

  it('clamps a 31st anchor to the 30th in April', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'MONTHLY',
      startAt: new Date('2026-01-31T08:00:00Z'),
      after: new Date('2026-04-01T00:00:00Z'),
      anchorDay: 31,
    })

    expect(local(next!)).toBe('2026-04-30 09:00')
  })

  it('crosses a year boundary', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'MONTHLY',
      startAt: new Date('2026-01-15T08:00:00Z'),
      after: new Date('2026-12-20T00:00:00Z'),
    })

    expect(local(next!)).toBe('2027-01-15 09:00')
  })
})

describe('yearly reminders', () => {
  it('advances a year', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'YEARLY',
      startAt: new Date('2026-03-15T08:00:00Z'),
      after: new Date('2026-06-01T00:00:00Z'),
    })

    expect(local(next!)).toBe('2027-03-15 09:00')
  })

  it('clamps 29 February to the 28th in a common year', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'YEARLY',
      startAt: new Date('2024-02-29T08:00:00Z'),
      after: new Date('2026-01-01T00:00:00Z'),
    })

    // Documented policy: clamp, never skip the year entirely (§26).
    expect(local(next!)).toBe('2026-02-28 09:00')
  })

  it('returns to the 29th in the next leap year', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'YEARLY',
      startAt: new Date('2024-02-29T08:00:00Z'),
      after: new Date('2028-01-01T00:00:00Z'),
      anchorDay: 29,
    })

    expect(local(next!)).toBe('2028-02-29 09:00')
  })
})

describe('hijri-yearly reminders', () => {
  it('advances by roughly a lunar year, not a solar one', () => {
    const startAt = new Date('2026-03-15T08:00:00Z')

    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'HIJRI_YEARLY',
      startAt,
      after: new Date('2026-06-01T00:00:00Z'),
    })

    const days = Math.round((next!.getTime() - startAt.getTime()) / 86_400_000)

    // A lunar year is ~354 days; a Gregorian anniversary would be 365.
    expect(days).toBeGreaterThan(350)
    expect(days).toBeLessThan(357)
  })

  it('still fires at the configured wall time', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'HIJRI_YEARLY',
      startAt: new Date('2026-03-15T08:00:00Z'),
      after: new Date('2026-06-01T00:00:00Z'),
    })

    expect(local(next!)).toContain('09:00')
  })
})

describe('series end', () => {
  it('returns null past endAt', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'DAILY',
      startAt: new Date('2026-06-01T07:00:00Z'),
      endAt: new Date('2026-06-10T00:00:00Z'),
      after: new Date('2026-06-15T00:00:00Z'),
    })

    expect(next).toBeNull()
  })

  it('still returns an occurrence inside the window', () => {
    const next = calculateNextOccurrence({
      ...base,
      recurrence: 'DAILY',
      startAt: new Date('2026-06-01T07:00:00Z'),
      endAt: new Date('2026-06-10T23:00:00Z'),
      after: new Date('2026-06-05T08:00:00Z'),
    })

    expect(local(next!)).toBe('2026-06-06 09:00')
  })
})

describe('validation', () => {
  it('rejects an invalid timezone', () => {
    expect(() =>
      calculateNextOccurrence({
        ...base,
        timezone: 'UTC+2',
        recurrence: 'DAILY',
        startAt: new Date('2026-06-01T07:00:00Z'),
        after: new Date('2026-06-02T00:00:00Z'),
      }),
    ).toThrow(InvalidTimezoneError)
  })
})

describe('determinism', () => {
  it('gives the same answer every time', () => {
    const input = {
      ...base,
      recurrence: 'MONTHLY' as const,
      startAt: new Date('2026-01-31T08:00:00Z'),
      after: new Date('2026-02-15T00:00:00Z'),
    }

    const a = calculateNextOccurrence(input)
    const b = calculateNextOccurrence(input)

    expect(a?.toISOString()).toBe(b?.toISOString())
  })
})

describe('occurrenceKey', () => {
  it('is stable for the same reminder and occurrence', () => {
    const occurrence = new Date('2026-06-15T07:00:00Z')

    expect(occurrenceKey('r1', occurrence)).toBe(occurrenceKey('r1', occurrence))
  })

  it('differs per reminder and per occurrence', () => {
    const a = new Date('2026-06-15T07:00:00Z')
    const b = new Date('2026-06-16T07:00:00Z')

    expect(occurrenceKey('r1', a)).not.toBe(occurrenceKey('r2', a))
    expect(occurrenceKey('r1', a)).not.toBe(occurrenceKey('r1', b))
  })
})
