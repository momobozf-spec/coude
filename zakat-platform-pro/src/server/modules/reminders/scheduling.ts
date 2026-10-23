import type { Recurrence } from '@/generated/prisma/client'

import { addHijriYears } from '@/server/modules/calendar/islamic-calendar'
import {
  assertValidTimezone,
  daysInMonth,
  instantForLocalDate,
  parseLocalTime,
  toWallClock,
} from '@/server/modules/reminders/timezone'

/**
 * Recurrence and next-occurrence calculation (§8, §9, §20).
 *
 * Pure and deterministic: recurrence, timezone, anchor and "now" go in, the next
 * instant comes out. No clock, no database. That is what lets DST, month-end and
 * leap-year behaviour be pinned down in tests instead of discovered in
 * production.
 *
 * ── Documented policies ──────────────────────────────────────────────────────
 * • **Month-end clamps.** A monthly reminder anchored on the 31st fires on the
 *   28th/29th in February and the 30th in April — it is never skipped, and it
 *   does not roll into the next month. The anchor day is remembered, so March
 *   returns to the 31st (§25).
 * • **Leap day clamps.** A yearly reminder on 29 February fires on 28 February
 *   in common years (§26).
 * • **Wall time is preserved.** Every occurrence is re-resolved from the local
 *   wall time, so 09:00 stays 09:00 across DST rather than drifting an hour.
 */

export class InvalidRecurrenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRecurrenceError'
  }
}

export interface OccurrenceInput {
  recurrence: Recurrence
  /** IANA zone. */
  timezone: string
  /** Wall-clock time of day, "HH:mm". */
  localTime: string
  /** First occurrence of the series, as an absolute instant. */
  startAt: Date
  /** Occurrences stop after this instant. */
  endAt?: Date | null
  /** Return the first occurrence strictly after this. */
  after: Date
  /**
   * Day-of-month the series was anchored to, so a clamped February does not
   * permanently shorten the series. Derived from `startAt` when omitted.
   */
  anchorDay?: number
}

/**
 * The first occurrence strictly after `after`, or null when the series is done.
 */
export function calculateNextOccurrence(input: OccurrenceInput): Date | null {
  assertValidTimezone(input.timezone)
  parseLocalTime(input.localTime)

  if (Number.isNaN(input.startAt.getTime())) {
    throw new InvalidRecurrenceError('De startdatum van deze herinnering is ongeldig.')
  }

  const next = computeNext(input)
  if (!next) return null

  // A series that has run past its end date is finished, not overdue.
  if (input.endAt && next.getTime() > input.endAt.getTime()) return null

  return next
}

function computeNext(input: OccurrenceInput): Date | null {
  const { recurrence, after, startAt } = input

  // The series has not begun yet: the first occurrence is the start itself.
  if (startAt.getTime() > after.getTime()) return startAt

  switch (recurrence) {
    case 'ONE_TIME':
      // Already past, and it never repeats.
      return null

    case 'DAILY':
      return stepByDays(input, 1)

    case 'WEEKLY':
      return stepByDays(input, 7)

    case 'MONTHLY':
      return stepByMonths(input, 1)

    case 'YEARLY':
      return stepByMonths(input, 12)

    case 'HIJRI_YEARLY':
      return stepByHijriYears(input)

    default: {
      const unreachable: never = recurrence
      throw new InvalidRecurrenceError(`Onbekende herhaling: ${String(unreachable)}`)
    }
  }
}

/**
 * Advance in whole local days.
 *
 * Steps the *local calendar date* rather than adding 24 hours, because a DST day
 * is 23 or 25 hours long and adding milliseconds would shift the wall time.
 */
function stepByDays(input: OccurrenceInput, days: number): Date {
  const wall = toWallClock(input.startAt, input.timezone)

  // Jump close to `after` in one go rather than looping from the start date,
  // which for a daily reminder created years ago would be tens of thousands of
  // iterations.
  const elapsedDays = Math.floor(
    (startOfUtcDay(input.after).getTime() - startOfUtcDay(input.startAt).getTime()) / 86_400_000,
  )
  const periods = Math.max(0, Math.floor(elapsedDays / days))

  let candidate = occurrenceAtDayOffset(wall, periods * days, input)

  // Walk forward until strictly after; at most a couple of steps.
  let guard = 0
  while (candidate.getTime() <= input.after.getTime() && guard < 400) {
    guard += 1
    candidate = occurrenceAtDayOffset(wall, (periods + guard) * days, input)
  }

  return candidate
}

function occurrenceAtDayOffset(
  wall: { year: number; month: number; day: number },
  offsetDays: number,
  input: OccurrenceInput,
): Date {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + offsetDays))

  return instantForLocalDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    input.localTime,
    input.timezone,
  )
}

/**
 * Advance in whole months, clamping the day to the target month's length.
 *
 * The anchor day is preserved across steps, so 31 Jan → 28 Feb → 31 Mar rather
 * than degrading to the 28th forever.
 */
function stepByMonths(input: OccurrenceInput, monthStep: number): Date {
  const wall = toWallClock(input.startAt, input.timezone)
  const anchorDay = input.anchorDay ?? wall.day

  const afterWall = toWallClock(input.after, input.timezone)

  const monthsElapsed =
    (afterWall.year - wall.year) * 12 + (afterWall.month - wall.month)
  const periods = Math.max(0, Math.floor(monthsElapsed / monthStep))

  let candidate = occurrenceAtMonthOffset(wall, anchorDay, periods * monthStep, input)

  let guard = 0
  while (candidate.getTime() <= input.after.getTime() && guard < 48) {
    guard += 1
    candidate = occurrenceAtMonthOffset(wall, anchorDay, (periods + guard) * monthStep, input)
  }

  return candidate
}

function occurrenceAtMonthOffset(
  wall: { year: number; month: number },
  anchorDay: number,
  offsetMonths: number,
  input: OccurrenceInput,
): Date {
  const zeroBased = wall.month - 1 + offsetMonths
  const year = wall.year + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12 + 1

  // Clamp, never roll over: 31 April would otherwise silently become 1 May.
  const day = Math.min(anchorDay, daysInMonth(year, month))

  return instantForLocalDate(year, month, day, input.localTime, input.timezone)
}

/**
 * Advance by whole Hijri years, so a Zakat anniversary tracks the lunar calendar
 * instead of drifting ~11 days a year through the Gregorian one.
 */
function stepByHijriYears(input: OccurrenceInput): Date {
  let candidate = input.startAt
  let guard = 0

  while (candidate.getTime() <= input.after.getTime() && guard < 200) {
    guard += 1
    const shifted = addHijriYears(input.startAt, guard)
    const wall = toWallClock(shifted, input.timezone)

    candidate = instantForLocalDate(
      wall.year,
      wall.month,
      wall.day,
      input.localTime,
      input.timezone,
    )
  }

  return candidate
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * A stable identity for one scheduled occurrence.
 *
 * Used as the notification dedupe key: two workers processing the same due
 * reminder compute the same string, and the unique index rejects the second
 * insert (§22).
 */
export function occurrenceKey(reminderId: string, occurrence: Date): string {
  return `reminder:${reminderId}:${occurrence.toISOString()}`
}
