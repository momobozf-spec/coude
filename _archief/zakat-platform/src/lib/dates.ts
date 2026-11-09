/**
 * Date helpers.
 *
 * Hijri conversion is intentionally *not* hand-rolled (§32) — it goes through
 * `Intl.DateTimeFormat` with the `islamic-umalqura` calendar, which ships with
 * ICU in Node and the browser. Users can always override the resulting date,
 * because moon sighting differs by region and no algorithm settles that.
 */

export interface HijriDate {
  year: number
  month: number
  day: number
  /** e.g. "15 Ramadan 1448" */
  formatted: string
}

const HIJRI_CALENDAR = 'islamic-umalqura'

export function toHijri(date: Date, locale = 'nl'): HijriDate {
  const formatter = new Intl.DateTimeFormat(`${locale}-u-ca-${HIJRI_CALENDAR}`, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })

  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value.replace(/\D/g, '') ?? '0')

  const long = new Intl.DateTimeFormat(`${locale}-u-ca-${HIJRI_CALENDAR}`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    formatted: long,
  }
}

/** A lunar year is ~354.367 days; used only to *suggest* a next due date. */
export const LUNAR_YEAR_DAYS = 354.367

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/**
 * The next occurrence of an annual Zakat date, on or after `from`.
 * Returns the anniversary itself when it has not passed yet this year.
 */
export function nextAnnualOccurrence(anchor: Date, from: Date = new Date()): Date {
  const next = new Date(
    Date.UTC(from.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
  )
  if (next.getTime() < startOfUtcDay(from).getTime()) {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  }
  return next
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function daysBetween(from: Date, to: Date): number {
  const ms = startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function startOfYear(year: number): Date {
  return new Date(Date.UTC(year, 0, 1))
}

export function endOfYear(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1))
}

export function formatDate(date: Date, locale = 'nl-BE'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
}

/** Falls back to the platform default when a stored timezone is no longer valid. */
export function safeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return 'Europe/Brussels'
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
    return timezone
  } catch {
    return 'Europe/Brussels'
  }
}
