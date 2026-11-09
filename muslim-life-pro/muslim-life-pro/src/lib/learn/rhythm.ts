import { diffInDays, type IsoDate } from '@/lib/dates'

/**
 * The learning rhythm — a forgiving streak.
 *
 * A daily streak punishes the people this module is for: someone with work,
 * study and a family who can give five minutes every two or three days. So the
 * rhythm holds as long as no more than {@link RHYTHM_MAX_GAP_DAYS} days pass
 * between two learning days. Learning on Monday and again on Thursday keeps it;
 * Monday and then Saturday does not.
 *
 * It counts learning days, not calendar days, so it never inflates on days
 * nobody opened the app.
 */
export const RHYTHM_MAX_GAP_DAYS = 3

export interface Rhythm {
  /** Learning days in the current, unbroken run. 0 when the run has lapsed. */
  current: number
  /** The longest run ever. */
  best: number
  /** Most recent learning day, if any. */
  lastDate: IsoDate | null
  /**
   * Days left before the current run lapses: 0 means "learn today to keep it".
   * `null` when there is no current run.
   */
  daysLeft: number | null
  /** Whether the member already learned today. */
  learnedToday: boolean
}

export function computeRhythm(dates: readonly IsoDate[], today: IsoDate): Rhythm {
  // Distinct, ascending, and never in the future (a clock or timezone change
  // must not create a run that has not happened yet).
  const days = [...new Set(dates)].filter((date) => diffInDays(date, today) >= 0).sort()

  if (days.length === 0) {
    return { current: 0, best: 0, lastDate: null, daysLeft: null, learnedToday: false }
  }

  let best = 1
  let run = 1
  for (let index = 1; index < days.length; index += 1) {
    const gap = diffInDays(days[index - 1]!, days[index]!)
    run = gap <= RHYTHM_MAX_GAP_DAYS ? run + 1 : 1
    if (run > best) best = run
  }

  const lastDate = days[days.length - 1]!
  const sinceLast = diffInDays(lastDate, today)
  const alive = sinceLast <= RHYTHM_MAX_GAP_DAYS

  return {
    current: alive ? run : 0,
    best,
    lastDate,
    daysLeft: alive ? RHYTHM_MAX_GAP_DAYS - sinceLast : null,
    learnedToday: sinceLast === 0,
  }
}
