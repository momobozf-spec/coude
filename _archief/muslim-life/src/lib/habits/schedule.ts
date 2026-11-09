import { dayOfWeek, type IsoDate } from '@/lib/dates'

/**
 * Habit scheduling rules.
 *
 * Pure functions, no I/O — the same logic decides what the dashboard shows and
 * what the weekly review counts, so it must be one implementation and testable.
 */

export type HabitFrequencyType = 'DAILY' | 'SPECIFIC_DAYS' | 'TIMES_PER_WEEK'
export type HabitLogStatus = 'COMPLETED' | 'PARTIAL' | 'SKIPPED'

export interface HabitSchedule {
  frequencyType: HabitFrequencyType
  /** 0 = Sunday … 6 = Saturday, in the user's local calendar. */
  daysOfWeek: number[]
  /** Days per week, for TIMES_PER_WEEK. */
  targetPerPeriod: number
}

/**
 * Is this habit expected on this local day?
 *
 * `TIMES_PER_WEEK` habits are never "due" on a particular day — the user chooses
 * which days to do them. Marking them due every day and then showing six misses a
 * week would be exactly the guilt mechanic we refuse to build. They are always
 * *available*, and progress is measured against the weekly target instead.
 */
export function isScheduledOn(schedule: HabitSchedule, date: IsoDate): boolean {
  switch (schedule.frequencyType) {
    case 'DAILY':
      return true
    case 'SPECIFIC_DAYS':
      return schedule.daysOfWeek.includes(dayOfWeek(date))
    case 'TIMES_PER_WEEK':
      return false
    default:
      return false
  }
}

/** Should the habit appear in today's list, even if not strictly "due"? */
export function isAvailableOn(schedule: HabitSchedule, date: IsoDate): boolean {
  return schedule.frequencyType === 'TIMES_PER_WEEK' || isScheduledOn(schedule, date)
}

/** How many days in a given week the habit is expected. */
export function expectedPerWeek(schedule: HabitSchedule): number {
  switch (schedule.frequencyType) {
    case 'DAILY':
      return 7
    case 'SPECIFIC_DAYS':
      return schedule.daysOfWeek.length
    case 'TIMES_PER_WEEK':
      return Math.max(1, Math.min(7, schedule.targetPerPeriod))
    default:
      return 7
  }
}

/**
 * Weekly progress for one habit.
 *
 * Returns plain counts. Deliberately no streak, no percentage-with-a-verdict, no
 * "you're behind" — the UI renders "3 of 5 days this week" and stops there.
 */
export interface WeeklyProgress {
  completed: number
  partial: number
  skipped: number
  expected: number
}

export function weeklyProgress(
  schedule: HabitSchedule,
  logs: { localDate: IsoDate; status: HabitLogStatus }[],
): WeeklyProgress {
  let completed = 0
  let partial = 0
  let skipped = 0

  for (const log of logs) {
    if (log.status === 'COMPLETED') completed += 1
    else if (log.status === 'PARTIAL') partial += 1
    else skipped += 1
  }

  return { completed, partial, skipped, expected: expectedPerWeek(schedule) }
}

/**
 * Derive a log status from a recorded quantity.
 * Anything above zero but under target is genuine partial progress, and is
 * recorded as such rather than as a failure.
 */
export function statusForQuantity(
  quantity: number,
  targetValue: number,
): HabitLogStatus | null {
  if (quantity <= 0) return null
  return quantity >= targetValue ? 'COMPLETED' : 'PARTIAL'
}
