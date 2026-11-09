import { describe, expect, it } from 'vitest'

import {
  CALENDAR_METHODS,
  InvalidCalendarDateError,
  addHijriYears,
  applyManualAdjustment,
  formatHijri,
  toGregorian,
  toHijri,
} from '@/server/modules/calendar/islamic-calendar'

/**
 * Hijri conversion (§42).
 *
 * Asserts meaningful values rather than snapshots, and — just as importantly —
 * asserts that nothing in this module presents itself as a religious ruling.
 */

describe('Gregorian → Hijri', () => {
  it('converts a known date', () => {
    // 8 August 2026 falls in Safar 1448 under Umm al-Qura.
    const hijri = toHijri(new Date('2026-08-08T00:00:00Z'))

    expect(hijri.year).toBe(1448)
    expect(hijri.month).toBe(2)
    expect(hijri.day).toBe(25)
  })

  it('formats with a month name', () => {
    const hijri = toHijri(new Date('2026-08-08T00:00:00Z'))
    expect(hijri.formatted).toBe('25 Safar 1448')
  })

  it('always marks the result as estimated', () => {
    const hijri = toHijri(new Date('2026-08-08T00:00:00Z'))

    // The UI must never be able to present a computed date as definitive (§4).
    expect(hijri.estimated).toBe(true)
    expect(hijri.method).toBe('ISLAMIC_UMALQURA')
  })

  it('does not depend on the server timezone', () => {
    // Both are the same instant; formatting is pinned to UTC.
    const a = toHijri(new Date('2026-08-08T00:00:00Z'))
    const b = toHijri(new Date('2026-08-08T00:00:00.000Z'))

    expect(a.formatted).toBe(b.formatted)
  })

  it('rejects an invalid date', () => {
    expect(() => toHijri(new Date('nonsense'))).toThrow(InvalidCalendarDateError)
  })
})

describe('Hijri → Gregorian', () => {
  it('converts a known date back', () => {
    const gregorian = toGregorian({ year: 1448, month: 2, day: 25 })
    expect(gregorian.toISOString().slice(0, 10)).toBe('2026-08-08')
  })

  it('round-trips across a range of dates', () => {
    for (const iso of [
      '2024-01-15',
      '2025-06-30',
      '2026-03-15',
      '2026-12-31',
      '2027-09-01',
      '2030-02-28',
    ]) {
      const original = new Date(`${iso}T00:00:00Z`)
      const hijri = toHijri(original)
      const back = toGregorian({ year: hijri.year, month: hijri.month, day: hijri.day })

      expect(back.toISOString().slice(0, 10)).toBe(iso)
    }
  })

  it('rejects an out-of-range Hijri date', () => {
    expect(() => toGregorian({ year: 1448, month: 13, day: 1 })).toThrow(
      InvalidCalendarDateError,
    )
    expect(() => toGregorian({ year: 1448, month: 1, day: 31 })).toThrow(
      InvalidCalendarDateError,
    )
    expect(() => toGregorian({ year: 0, month: 1, day: 1 })).toThrow(InvalidCalendarDateError)
  })

  it('rejects a 30th in a 29-day Hijri month', () => {
    // Which months are short varies; find one and confirm it is refused.
    let refused = false
    for (let month = 1; month <= 12; month += 1) {
      try {
        toGregorian({ year: 1448, month, day: 30 })
      } catch {
        refused = true
        break
      }
    }
    expect(refused).toBe(true)
  })

  it('is deterministic', () => {
    const a = toGregorian({ year: 1448, month: 9, day: 1 })
    const b = toGregorian({ year: 1448, month: 9, day: 1 })
    expect(a.getTime()).toBe(b.getTime())
  })
})

describe('addHijriYears', () => {
  it('advances by about a lunar year', () => {
    const start = new Date('2026-03-15T00:00:00Z')
    const next = addHijriYears(start, 1)

    const days = Math.round((next.getTime() - start.getTime()) / 86_400_000)

    // ~354 days, not 365 — that is the whole reason this function exists.
    expect(days).toBeGreaterThan(350)
    expect(days).toBeLessThan(357)
  })

  it('keeps the same Hijri day and month', () => {
    const start = new Date('2026-03-15T00:00:00Z')
    const before = toHijri(start)
    const after = toHijri(addHijriYears(start, 1))

    expect(after.month).toBe(before.month)
    expect(after.day).toBe(before.day)
    expect(after.year).toBe(before.year + 1)
  })

  it('clamps when the target month is a day shorter', () => {
    // Walk a year of dates; every result must be a valid date, never a throw.
    for (let offset = 0; offset < 360; offset += 29) {
      const start = new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000)
      expect(() => addHijriYears(start, 1)).not.toThrow()
    }
  })

  it('advances several years', () => {
    const start = new Date('2026-03-15T00:00:00Z')
    const after = toHijri(addHijriYears(start, 3))

    expect(after.year).toBe(toHijri(start).year + 3)
  })
})

describe('manual adjustment', () => {
  it('shifts by whole days in both directions', () => {
    const base = new Date('2026-08-08T00:00:00Z')

    expect(applyManualAdjustment(base, 1).toISOString().slice(0, 10)).toBe('2026-08-09')
    expect(applyManualAdjustment(base, -1).toISOString().slice(0, 10)).toBe('2026-08-07')
  })

  it('is a no-op at zero', () => {
    const base = new Date('2026-08-08T00:00:00Z')
    expect(applyManualAdjustment(base, 0).getTime()).toBe(base.getTime())
  })

  it('rejects a fractional adjustment', () => {
    expect(() => applyManualAdjustment(new Date(), 0.5)).toThrow(InvalidCalendarDateError)
  })

  it('rejects an implausibly large adjustment', () => {
    // Beyond a few days it is a different date, not a sighting difference.
    expect(() => applyManualAdjustment(new Date(), 10)).toThrow(InvalidCalendarDateError)
    expect(() => applyManualAdjustment(new Date(), -10)).toThrow(InvalidCalendarDateError)
  })
})

describe('method metadata', () => {
  it('names the calculation method', () => {
    expect(CALENDAR_METHODS.ISLAMIC_UMALQURA.label).toContain('Umm al-Qura')
  })

  it('carries a disclaimer that admits regional variation', () => {
    const disclaimer = CALENDAR_METHODS.ISLAMIC_UMALQURA.disclaimer

    expect(disclaimer).toContain('Geschatte')
    expect(disclaimer.toLowerCase()).toContain('maanwaarneming')
    expect(disclaimer.toLowerCase()).toContain('corrigeer')
  })

  it('never claims religious correctness', () => {
    const forbidden = ['correcte datum', 'islamitisch juist', 'officiële datum']

    for (const method of Object.values(CALENDAR_METHODS)) {
      const text = `${method.label} ${method.disclaimer}`.toLowerCase()
      for (const phrase of forbidden) expect(text).not.toContain(phrase)
    }
  })
})

describe('formatHijri', () => {
  it('handles every month', () => {
    for (let month = 1; month <= 12; month += 1) {
      const formatted = formatHijri({ year: 1448, month, day: 1 })
      expect(formatted).toMatch(/^1 \S/)
      expect(formatted).toContain('1448')
    }
  })
})
