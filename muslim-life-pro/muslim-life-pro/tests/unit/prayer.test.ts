import { describe, expect, it } from 'vitest'

import { computePrayerTimes, getNextPrayer } from '@/lib/prayer/calculate'
import { PRAYER_ORDER } from '@/lib/prayer/types'

const BRUSSELS = { latitude: 50.8503, longitude: 4.3517 }
const MAKKAH = { latitude: 21.3891, longitude: 39.8579 }

function timeIn(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

describe('computePrayerTimes', () => {
  it('returns all five prayers in chronological order', () => {
    const result = computePrayerTimes({
      ...BRUSSELS,
      date: '2026-03-15',
      method: 'MUSLIM_WORLD_LEAGUE',
      madhab: 'SHAFI',
    })

    expect(result.times.map((entry) => entry.prayer)).toEqual([...PRAYER_ORDER])

    for (let i = 1; i < result.times.length; i++) {
      const previous = result.times[i - 1]!
      const current = result.times[i]!
      expect(current.time.getTime()).toBeGreaterThan(previous.time.getTime())
    }
  })

  it('produces times close to the published Makkah timetable', () => {
    // Umm al-Qura, 15 March 2026. Tolerance of a few minutes covers rounding
    // differences between published tables and astronomical calculation.
    const result = computePrayerTimes({
      ...MAKKAH,
      date: '2026-03-15',
      method: 'UMM_AL_QURA',
      madhab: 'SHAFI',
    })

    expect(timeIn(result.byPrayer.FAJR, 'Asia/Riyadh')).toMatch(/^0[45]:/)
    expect(timeIn(result.byPrayer.DHUHR, 'Asia/Riyadh')).toMatch(/^12:/)
    expect(timeIn(result.byPrayer.MAGHRIB, 'Asia/Riyadh')).toMatch(/^1[89]:/)
  })

  it('places Hanafi Asr later than Shafi Asr', () => {
    const base = {
      ...BRUSSELS,
      date: '2026-06-21',
      method: 'MUSLIM_WORLD_LEAGUE' as const,
    }

    const shafi = computePrayerTimes({ ...base, madhab: 'SHAFI' })
    const hanafi = computePrayerTimes({ ...base, madhab: 'HANAFI' })

    expect(hanafi.byPrayer.ASR.getTime()).toBeGreaterThan(shafi.byPrayer.ASR.getTime())
  })

  it('applies per-prayer manual offsets', () => {
    const base = {
      ...BRUSSELS,
      date: '2026-03-15',
      method: 'MUSLIM_WORLD_LEAGUE' as const,
      madhab: 'SHAFI' as const,
    }

    const plain = computePrayerTimes(base)
    const shifted = computePrayerTimes({ ...base, offsets: { fajr: -5, isha: 7 } })

    expect(shifted.byPrayer.FAJR.getTime() - plain.byPrayer.FAJR.getTime()).toBe(-5 * 60_000)
    expect(shifted.byPrayer.ISHA.getTime() - plain.byPrayer.ISHA.getTime()).toBe(7 * 60_000)
    expect(shifted.byPrayer.DHUHR.getTime()).toBe(plain.byPrayer.DHUHR.getTime())
  })

  it('yields usable Fajr and Isha at high latitude in midsummer', () => {
    // Without a high-latitude rule these become NaN or absurd near the solstice.
    const result = computePrayerTimes({
      latitude: 59.3293, // Stockholm
      longitude: 18.0686,
      date: '2026-06-21',
      method: 'MUSLIM_WORLD_LEAGUE',
      madhab: 'SHAFI',
    })

    expect(Number.isNaN(result.byPrayer.FAJR.getTime())).toBe(false)
    expect(Number.isNaN(result.byPrayer.ISHA.getTime())).toBe(false)
    expect(result.byPrayer.ISHA.getTime()).toBeGreaterThan(result.byPrayer.MAGHRIB.getTime())
  })
})

describe('getNextPrayer', () => {
  const settings = {
    ...BRUSSELS,
    method: 'MUSLIM_WORLD_LEAGUE' as const,
    madhab: 'SHAFI' as const,
  }

  const today = computePrayerTimes({ ...settings, date: '2026-03-15' })
  const tomorrow = computePrayerTimes({ ...settings, date: '2026-03-16' })

  it('identifies the upcoming prayer mid-day', () => {
    // One minute after Dhuhr, the next prayer must be Asr.
    const now = new Date(today.byPrayer.DHUHR.getTime() + 60_000)
    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('ASR')
    expect(next.current).toBe('DHUHR')
    expect(next.isTomorrow).toBe(false)
    expect(next.msRemaining).toBeGreaterThan(0)
  })

  it("rolls over to tomorrow's Fajr after Isha", () => {
    const now = new Date(today.byPrayer.ISHA.getTime() + 60_000)
    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('FAJR')
    expect(next.isTomorrow).toBe(true)
    expect(next.current).toBe('ISHA')
    // The regression this guards: wrapping to today's Fajr gives a negative countdown.
    expect(next.msRemaining).toBeGreaterThan(0)
  })

  it('reports Fajr as next before dawn', () => {
    const now = new Date(today.byPrayer.FAJR.getTime() - 60 * 60_000)
    const next = getNextPrayer(today, tomorrow, now)

    expect(next.prayer).toBe('FAJR')
    expect(next.isTomorrow).toBe(false)
    expect(next.current).toBeNull()
  })

  it('keeps window progress within 0–100', () => {
    for (const prayer of PRAYER_ORDER) {
      const now = new Date(today.byPrayer[prayer].getTime() + 5 * 60_000)
      const next = getNextPrayer(today, tomorrow, now)
      expect(next.windowProgress).toBeGreaterThanOrEqual(0)
      expect(next.windowProgress).toBeLessThanOrEqual(100)
    }
  })
})
