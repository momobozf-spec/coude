/**
 * Calendar-day utilities.
 *
 * The rule this module exists to enforce: habit ticks, prayer logs and planner
 * entries belong to *the user's local calendar day*, not to an instant in time.
 * Ticking Isha at 23:50 in Brussels must land on that day, not the next one in UTC.
 *
 * We therefore represent a day as an ISO date string ("YYYY-MM-DD") throughout the
 * application, and only convert to a Date at the database boundary (@db.Date).
 */

export type IsoDate = string // "YYYY-MM-DD"

/** The current calendar date in a given IANA timezone. */
export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  return toIsoDateIn(now, timezone)
}

/** Convert an instant to the calendar date it falls on in a given timezone. */
export function toIsoDateIn(instant: Date, timezone: string): IsoDate {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA formats as YYYY-MM-DD.
  return formatter.format(instant)
}

/**
 * A Date pinned to UTC midnight of the given calendar day.
 * This is the only correct value to store in a Postgres `date` column via Prisma.
 */
export function isoDateToUtcDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

/** Inverse of {@link isoDateToUtcDate}. */
export function utcDateToIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = isoDateToUtcDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return utcDateToIsoDate(d)
}

export function diffInDays(from: IsoDate, to: IsoDate): number {
  const ms = isoDateToUtcDate(to).getTime() - isoDateToUtcDate(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function isSameDay(a: IsoDate, b: IsoDate): boolean {
  return a === b
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: IsoDate): number {
  return isoDateToUtcDate(date).getUTCDay()
}

/**
 * The first day of the week containing `date`.
 * @param weekStartsOn 0 = Sunday, 1 = Monday (the default across Europe)
 */
export function startOfWeek(date: IsoDate, weekStartsOn: 0 | 1 = 1): IsoDate {
  const dow = dayOfWeek(date)
  const delta = (dow - weekStartsOn + 7) % 7
  return addDays(date, -delta)
}

export function endOfWeek(date: IsoDate, weekStartsOn: 0 | 1 = 1): IsoDate {
  return addDays(startOfWeek(date, weekStartsOn), 6)
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: IsoDate): IsoDate {
  const d = isoDateToUtcDate(startOfMonth(date))
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return utcDateToIsoDate(d)
}

/** Inclusive range of calendar days. */
export function rangeOfDays(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  const total = diffInDays(from, to)
  for (let i = 0; i <= total; i++) days.push(addDays(from, i))
  return days
}

/** The last `count` days ending at (and including) `date`. */
export function lastNDays(date: IsoDate, count: number): IsoDate[] {
  return rangeOfDays(addDays(date, -(count - 1)), date)
}

/** "YYYY-MM" — the period key used by AI usage quotas. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7)
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatDate(
  date: IsoDate,
  locale = 'en',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    isoDateToUtcDate(date),
  )
}

export function formatWeekday(date: IsoDate, locale = 'en', short = true): string {
  return formatDate(date, locale, { weekday: short ? 'short' : 'long' })
}

/** Format an instant as a wall clock time in a given timezone. */
export function formatTime(
  instant: Date,
  timezone: string,
  use12Hour = false,
  locale = 'en',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: use12Hour,
  }).format(instant)
}

/** "1h 21m" / "12m" / "now" — used by the prayer countdown. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/**
 * Time-of-day bucket, used to pick the dashboard greeting.
 * Derived from the user's timezone, never from the server clock.
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export function timeOfDayIn(timezone: string, now: Date = new Date()): TimeOfDay {
  const hourString = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(now)
  const hour = Number.parseInt(hourString, 10)

  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

/**
 * Minutes past local midnight in `timezone`.
 *
 * Used for anything expressed as a wall-clock window — quiet hours, reminder
 * offsets — so the window means the same thing after a DST change or a move.
 */
export function minutesOfDayIn(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimezone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)

  // `en-GB` renders midnight as 24 in some runtimes; normalise it to 0.
  return ((hour % 24) * 60 + minute) % 1440
}

/** Guard against invalid timezone strings reaching Intl (which throws). */
export function safeTimezone(timezone: string | null | undefined, fallback = 'Europe/Brussels') {
  if (!timezone) return fallback
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
    return timezone
  } catch {
    return fallback
  }
}
