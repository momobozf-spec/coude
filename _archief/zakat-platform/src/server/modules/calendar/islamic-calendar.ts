/**
 * Hijri ↔ Gregorian conversion (§3, §4, §5).
 *
 * ── What this is, and what it is not ─────────────────────────────────────────
 * This is an *arithmetic* calendar conversion using the Umm al-Qura tabular
 * calendar that ships with ICU. It is a technical computation, not a religious
 * determination. Real Islamic dates can depend on local moon sighting, on the
 * region, and on the authority a person follows — none of which an algorithm
 * settles. Every date this module produces is therefore labelled "estimated",
 * and the domain always keeps a user-supplied `manualAdjustmentDays` correction
 * alongside it.
 *
 * Pure and dependency-free: no clock, no locale side effects, no database. The
 * reference date is always an argument, so conversions are reproducible.
 */

export type CalendarMethodId = 'GREGORIAN' | 'ISLAMIC_UMALQURA'

export interface CalendarMethodInfo {
  id: CalendarMethodId
  label: string
  /** Shown wherever a converted date appears, so the limits travel with it. */
  disclaimer: string
}

export const CALENDAR_METHODS: Record<CalendarMethodId, CalendarMethodInfo> = {
  GREGORIAN: {
    id: 'GREGORIAN',
    label: 'Gregoriaanse kalender',
    disclaimer: 'Een gewone kalenderdatum.',
  },
  ISLAMIC_UMALQURA: {
    id: 'ISLAMIC_UMALQURA',
    label: 'Umm al-Qura (rekenkundig)',
    disclaimer:
      'Geschatte Hijri-datum, berekend volgens de Umm al-Qura-kalender. Maanwaarneming ' +
      'verschilt per regio en per autoriteit — corrigeer de datum als die bij jou anders valt.',
  },
}

export interface HijriDate {
  year: number
  month: number
  day: number
}

export interface HijriDisplay extends HijriDate {
  /** e.g. "25 Safar 1448". */
  formatted: string
  method: CalendarMethodId
  /** Always true for a computed date, so the UI cannot forget to say so. */
  estimated: true
}

export class InvalidCalendarDateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCalendarDateError'
  }
}

const CALENDAR_TAG = 'islamic-umalqura'

/** Month names, so display does not depend on the runtime's locale data. */
const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
] as const

/**
 * Gregorian instant → Hijri date.
 *
 * Formatting is pinned to UTC: the same instant must not become a different
 * Hijri day because the server happens to run in another zone.
 */
export function toHijri(date: Date): HijriDisplay {
  assertValidDate(date)

  const parts = new Intl.DateTimeFormat(`en-u-ca-${CALENDAR_TAG}`, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value ?? ''
    const digits = value.replace(/\D/g, '')
    return Number(digits)
  }

  const year = read('year')
  const month = read('month')
  const day = read('day')

  if (!year || !month || !day) {
    throw new InvalidCalendarDateError('Kon deze datum niet omzetten naar de Hijri-kalender.')
  }

  return {
    year,
    month,
    day,
    formatted: formatHijri({ year, month, day }),
    method: 'ISLAMIC_UMALQURA',
    estimated: true,
  }
}

export function formatHijri(date: HijriDate): string {
  const month = HIJRI_MONTHS[date.month - 1] ?? `maand ${date.month}`
  return `${date.day} ${month} ${date.year}`
}

/**
 * Hijri date → Gregorian instant (UTC midnight).
 *
 * ICU offers no inverse, so this binary-searches the day index. A Hijri year is
 * ~354.367 days; the estimate lands within a few days and the search closes the
 * gap exactly. Deterministic, and bounded to a fixed number of steps.
 */
export function toGregorian(hijri: HijriDate): Date {
  assertValidHijri(hijri)

  // Anchor: 1 Muharram 1 AH ≈ 16 July 622 CE (Julian), 19 July 622 proleptic
  // Gregorian. Only used as a starting estimate; the search decides the answer.
  const HIJRI_EPOCH_UTC = Date.UTC(622, 6, 19)
  const LUNAR_YEAR_DAYS = 354.367
  const LUNAR_MONTH_DAYS = 29.53059

  const estimateDays = Math.floor(
    (hijri.year - 1) * LUNAR_YEAR_DAYS + (hijri.month - 1) * LUNAR_MONTH_DAYS + (hijri.day - 1),
  )

  let low = estimateDays - 15
  let high = estimateDays + 15

  const dayAt = (offset: number) => new Date(HIJRI_EPOCH_UTC + offset * 86_400_000)
  const compare = (offset: number) => compareHijri(toHijri(dayAt(offset)), hijri)

  // Widen if the estimate was further out than the initial window.
  let guard = 0
  while (compare(low) > 0 && guard < 40) {
    low -= 30
    guard += 1
  }
  guard = 0
  while (compare(high) < 0 && guard < 40) {
    high += 30
    guard += 1
  }

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const cmp = compare(mid)

    if (cmp === 0) return dayAt(mid)
    if (cmp < 0) low = mid + 1
    else high = mid - 1
  }

  throw new InvalidCalendarDateError(
    `${formatHijri(hijri)} bestaat niet in de Umm al-Qura-kalender.`,
  )
}

function compareHijri(a: HijriDate, b: HijriDate): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

/**
 * Add whole Hijri years to a Gregorian instant.
 *
 * Used by HIJRI_YEARLY reminders so a Zakat anniversary tracks the lunar year
 * instead of drifting ~11 days through the Gregorian calendar each year. The day
 * is clamped when the target month is shorter (a 30th in a 29-day month).
 */
export function addHijriYears(date: Date, years: number): Date {
  const current = toHijri(date)
  const target = { year: current.year + years, month: current.month, day: current.day }

  try {
    return toGregorian(target)
  } catch {
    // Clamp to the last valid day of that Hijri month.
    for (let day = target.day - 1; day >= 28; day -= 1) {
      try {
        return toGregorian({ ...target, day })
      } catch {
        continue
      }
    }
    throw new InvalidCalendarDateError(
      `Kon geen geldige Hijri-datum vinden voor jaar ${target.year}.`,
    )
  }
}

/** Apply a user's day correction on top of a computed date (§3). */
export function applyManualAdjustment(date: Date, days: number): Date {
  if (!Number.isInteger(days)) {
    throw new InvalidCalendarDateError('Een correctie moet een heel aantal dagen zijn.')
  }
  // A correction beyond a couple of days is a different date, not a sighting
  // difference — rejecting it keeps the field meaning what it says.
  if (Math.abs(days) > 3) {
    throw new InvalidCalendarDateError('Een correctie van meer dan drie dagen is niet toegestaan.')
  }
  return new Date(date.getTime() + days * 86_400_000)
}

function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new InvalidCalendarDateError('Ongeldige datum.')
  }
}

function assertValidHijri(hijri: HijriDate): void {
  if (
    !Number.isInteger(hijri.year) ||
    !Number.isInteger(hijri.month) ||
    !Number.isInteger(hijri.day) ||
    hijri.year < 1 ||
    hijri.year > 2000 ||
    hijri.month < 1 ||
    hijri.month > 12 ||
    hijri.day < 1 ||
    hijri.day > 30
  ) {
    throw new InvalidCalendarDateError(
      `Ongeldige Hijri-datum: ${hijri.day}/${hijri.month}/${hijri.year}.`,
    )
  }
}
