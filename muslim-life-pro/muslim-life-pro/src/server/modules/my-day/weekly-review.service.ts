import 'server-only'

import type { Actor } from '@/server/auth/actor'
import { endOfWeek, rangeOfDays, startOfWeek, type IsoDate } from '@/lib/dates'
import { countPrayersBetween } from '@/server/modules/prayer/prayer.service'
import { countTasksBetween } from '@/server/modules/planner/task.service'
import { countReflectionsBetween } from '@/server/modules/reflection/reflection.service'
import { getWeeklySummaries, type HabitWeekSummary } from '@/server/modules/habits/habit.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

/**
 * Weekly review.
 *
 * Reports each domain separately and never combines them. There is deliberately
 * no total, no percentage of the week, no grade and no comparison with last week:
 * a single number spanning prayer, habits and tasks would be a faith score, and
 * a week-on-week delta on worship is the guilt mechanic in another costume.
 */

export interface WeeklyReview {
  weekStart: IsoDate
  weekEnd: IsoDate
  days: IsoDate[]

  prayers: {
    logged: number
    excused: number
    /** 5 per day across the week — context, not a target to fail. */
    possible: number
  }

  habits: HabitWeekSummary[]

  tasks: {
    planned: number
    completed: number
  }

  reflections: {
    days: number
    outOf: number
  }
}

export async function getWeeklyReview(
  actor: Actor,
  date: IsoDate,
  weekStartsOn: 0 | 1 = 1,
): Promise<WeeklyReview> {
  const weekStart = startOfWeek(date, weekStartsOn)
  const weekEnd = endOfWeek(date, weekStartsOn)
  const days = rangeOfDays(weekStart, weekEnd)

  const [prayers, tasks, reflections, habits] = await Promise.all([
    countPrayersBetween(actor, weekStart, weekEnd),
    countTasksBetween(actor, weekStart, weekEnd),
    countReflectionsBetween(actor, weekStart, weekEnd),
    getWeeklySummaries(actor, date, weekStartsOn),
  ])

  await track(actor.userId, ANALYTICS_EVENTS.WEEKLY_REVIEW_OPENED, {})

  return {
    weekStart,
    weekEnd,
    days,
    prayers: {
      logged: prayers.logged,
      excused: prayers.excused,
      possible: days.length * 5,
    },
    habits,
    tasks,
    reflections: { days: reflections, outOf: days.length },
  }
}
