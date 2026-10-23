import { describe, expect, it } from 'vitest'

import { computePrayerTimes, getNextPrayer } from '@/lib/prayer/calculate'
import { instantToClockTime } from '@/lib/planner/time'
import { toIsoDateIn } from '@/lib/dates'
import { COMPLETED_PRAYER_STATUSES, isCompletedStatus } from '@/lib/prayer/types'

/**
 * The prayer edge cases that actually break in production: the wrap past Isha,
 * daylight saving, high latitude in midsummer, and the meaning of EXCUSED.
 */

const BRUSSELS = { latitude: 50.8503, longitude: 4.3517 }
const TROMSO = { latitude: 69.6496, longitude: 18.956 } // inside the Arctic Circle
const TZ = 'Europe/Brussels'

const settings = {
  ...BRUSSELS,
  method: 'MUSLIM_WORLD_LEAGUE' as const,
  madhab: 'SHAFI' as const,
}

function dayPair(date: string, next: string) {
  return {
    today: computePrayerTimes({ ...settings, date }),
    tomorrow: computePrayerTimes({ ...settings, date: next }),
  }
}

describe('next prayer — before Fajr', () => {
  it('points at Fajr with no current window', () => {
    const { today, tomorrow } = dayPair('2026-08-07', '2026-08-08')
    const now = new Date(today.byPrayer.FAJR.getTime() - 90 * 60_000)

    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('FAJR')
    expect(next.isTomorrow).toBe(false)
    expect(next.current).toBeNull()
    expect(next.windowProgress).toBe(0)
    expect(next.msRemaining).toBeGreaterThan(0)
  })
})

describe('next prayer — between prayers', () => {
  it('reports Asr while inside the Dhuhr window', () => {
    const { today, tomorrow } = dayPair('2026-08-07', '2026-08-08')
    const now = new Date(today.byPrayer.DHUHR.getTime() + 30 * 60_000)

    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('ASR')
    expect(next.current).toBe('DHUHR')
    expect(next.windowProgress).toBeGreaterThan(0)
    expect(next.windowProgress).toBeLessThan(100)
  })

  it('advances through every window in order', () => {
    const { today, tomorrow } = dayPair('2026-08-07', '2026-08-08')
    const expected = [
      ['FAJR', 'DHUHR'],
      ['DHUHR', 'ASR'],
      ['ASR', 'MAGHRIB'],
      ['MAGHRIB', 'ISHA'],
    ] as const

    for (const [current, upcoming] of expected) {
      const now = new Date(today.byPrayer[current].getTime() + 60_000)
      const next = getNextPrayer(today, tomorrow, now)

      expect(next.current).toBe(current)
      expect(next.prayer).toBe(upcoming)
    }
  })
})

describe('next prayer — after Isha', () => {
  it("wraps to tomorrow's Fajr with a positive countdown", () => {
    const { today, tomorrow } = dayPair('2026-08-07', '2026-08-08')
    const now = new Date(today.byPrayer.ISHA.getTime() + 5 * 60_000)

    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('FAJR')
    expect(next.isTomorrow).toBe(true)
    expect(next.current).toBe('ISHA')
    // The regression this guards: wrapping to today's Fajr yields a negative value.
    expect(next.msRemaining).toBeGreaterThan(0)
    expect(next.time.getTime()).toBe(tomorrow.byPrayer.FAJR.getTime())
  })

  it('still wraps correctly just before local midnight', () => {
    const { today, tomorrow } = dayPair('2026-08-07', '2026-08-08')
    // 23:50 local on the 7th.
    const now = new Date('2026-08-07T21:50:00.000Z')

    const next = getNextPrayer(today, tomorrow, now)

    if (now.getTime() > today.byPrayer.ISHA.getTime()) {
      expect(next.isTomorrow).toBe(true)
      expect(next.prayer).toBe('FAJR')
    }
    expect(next.msRemaining).toBeGreaterThan(0)
  })
})

describe('daylight saving transitions', () => {
  it('keeps prayer times ordered across the spring forward', () => {
    // Europe moves to summer time on 29 March 2026 at 02:00 local.
    for (const date of ['2026-03-28', '2026-03-29', '2026-03-30']) {
      const times = computePrayerTimes({ ...settings, date })

      for (let i = 1; i < times.times.length; i++) {
        expect(times.times[i]!.time.getTime()).toBeGreaterThan(times.times[i - 1]!.time.getTime())
      }
    }
  })

  it('keeps prayer times ordered across the autumn fall back', () => {
    // Europe returns to winter time on 25 October 2026.
    for (const date of ['2026-10-24', '2026-10-25', '2026-10-26']) {
      const times = computePrayerTimes({ ...settings, date })

      for (let i = 1; i < times.times.length; i++) {
        expect(times.times[i]!.time.getTime()).toBeGreaterThan(times.times[i - 1]!.time.getTime())
      }
    }
  })

  it('shows a plausible local Dhuhr on both sides of the change', () => {
    // Dhuhr tracks solar noon, so local wall-clock time shifts by roughly an
    // hour across the transition rather than staying identical.
    const before = computePrayerTimes({ ...settings, date: '2026-03-28' })
    const after = computePrayerTimes({ ...settings, date: '2026-03-30' })

    const beforeClock = instantToClockTime(before.byPrayer.DHUHR, TZ)
    const afterClock = instantToClockTime(after.byPrayer.DHUHR, TZ)

    expect(beforeClock).toMatch(/^1[23]:/)
    expect(afterClock).toMatch(/^1[34]:/)
  })

  it("keeps each prayer on the day it belongs to in the user's timezone", () => {
    const times = computePrayerTimes({ ...settings, date: '2026-03-29' })

    for (const entry of times.times) {
      expect(toIsoDateIn(entry.time, TZ)).toBe('2026-03-29')
    }
  })
})

describe('Brussels summer', () => {
  it('puts Isha after local midnight, still belonging to that day', () => {
    // At 50°N near the solstice Isha genuinely falls at ~01:45 the NEXT calendar
    // day. It is still one of that day's five prayers, which is why the timeline
    // sorts on minutes-from-day-start rather than on the clock string.
    const times = computePrayerTimes({ ...settings, date: '2026-06-21' })

    expect(times.byPrayer.ISHA.getTime()).toBeGreaterThan(times.byPrayer.MAGHRIB.getTime())
    expect(toIsoDateIn(times.byPrayer.ISHA, TZ)).toBe('2026-06-22')

    const ishaClock = instantToClockTime(times.byPrayer.ISHA, TZ)
    // A naive string sort would place this above Fajr.
    expect(Number(ishaClock.slice(0, 2))).toBeLessThan(4)
  })

  it('never yields NaN in midsummer', () => {
    const times = computePrayerTimes({ ...settings, date: '2026-06-21' })

    for (const entry of times.times) {
      expect(Number.isNaN(entry.time.getTime())).toBe(false)
    }
  })
})

describe('high latitude', () => {
  it('yields finite times inside the Arctic Circle at the solstice', () => {
    // Without a high-latitude rule these are NaN, and the dashboard renders
    // "Invalid Date" — the single most visible possible failure.
    const times = computePrayerTimes({
      ...TROMSO,
      date: '2026-06-21',
      method: 'MUSLIM_WORLD_LEAGUE',
      madhab: 'SHAFI',
    })

    for (const entry of times.times) {
      expect(Number.isNaN(entry.time.getTime())).toBe(false)
    }
  })

  it('respects an explicit high-latitude rule', () => {
    const base = {
      ...TROMSO,
      date: '2026-06-21',
      method: 'MUSLIM_WORLD_LEAGUE' as const,
      madhab: 'SHAFI' as const,
    }

    const middle = computePrayerTimes({ ...base, highLatitudeRule: 'MIDDLE_OF_THE_NIGHT' })
    const seventh = computePrayerTimes({ ...base, highLatitudeRule: 'SEVENTH_OF_THE_NIGHT' })

    expect(Number.isNaN(middle.byPrayer.FAJR.getTime())).toBe(false)
    expect(Number.isNaN(seventh.byPrayer.FAJR.getTime())).toBe(false)
    // The two rules must not coincidentally agree — otherwise the setting is a no-op.
    expect(middle.byPrayer.FAJR.getTime()).not.toBe(seventh.byPrayer.FAJR.getTime())
  })

  it('still produces a usable next prayer at high latitude', () => {
    const today = computePrayerTimes({
      ...TROMSO,
      date: '2026-06-21',
      method: 'MUSLIM_WORLD_LEAGUE',
      madhab: 'SHAFI',
    })
    const tomorrow = computePrayerTimes({
      ...TROMSO,
      date: '2026-06-22',
      method: 'MUSLIM_WORLD_LEAGUE',
      madhab: 'SHAFI',
    })

    const next = getNextPrayer(today, tomorrow, new Date('2026-06-21T12:00:00.000Z'))

    expect(Number.isNaN(next.msRemaining)).toBe(false)
    expect(next.msRemaining).toBeGreaterThan(0)
  })
})

describe('prayer status vocabulary', () => {
  it('counts on-time, late and jamaah as prayed', () => {
    expect(isCompletedStatus('ON_TIME')).toBe(true)
    expect(isCompletedStatus('LATE')).toBe(true)
    expect(isCompletedStatus('JAMAAH')).toBe(true)
  })

  it('does not count EXCUSED as prayed', () => {
    expect(isCompletedStatus('EXCUSED')).toBe(false)
  })

  it('does not count EXCUSED as missed either', () => {
    // This is the product rule: excused is its own neutral state. It must never
    // be folded into the completed set, and never presented as a failure.
    expect(COMPLETED_PRAYER_STATUSES).not.toContain('EXCUSED')
    expect(COMPLETED_PRAYER_STATUSES).not.toContain('MISSED')
    expect(isCompletedStatus('MISSED')).toBe(false)
  })
})
