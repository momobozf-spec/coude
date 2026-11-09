import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { addDays, rangeOfDays, todayIn, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import { isoDateToUtcDate } from '@/lib/dates'
import { instantToClockTime, toMinutes, type ClockTime } from '@/lib/planner/time'
import { computeForDay, getPrayerSettings } from '@/server/modules/prayer/prayer.service'
import { PRAYER_LABELS } from '@/lib/prayer/types'

/**
 * Context assembly.
 *
 * Two rules govern what the assistant is allowed to know.
 *
 * **Least context.** Only what the current task needs. Not the whole account,
 * not months of history, not every habit log. More context is not better — it is
 * more tokens, more cost, and more of someone's life sent to a third party.
 *
 * **Safe vs sensitive.** Some data is categorically excluded from anything sent
 * to an external provider, regardless of the task:
 *
 *   SAFE      — local date, timezone, city, today's prayer times, active habit
 *               NAMES, upcoming task titles, planner blocks, stated goals.
 *   SENSITIVE — daily reflections, task descriptions and notes, prayer LOGS
 *               (whether someone prayed), habit completion history, AI
 *               conversation content from other threads.
 *
 * Sensitive data never enters a prompt automatically. If a member wants to
 * discuss their reflection, they can paste it themselves — that is a deliberate
 * act of sharing, which is different from an app quietly forwarding it.
 */

export type ContextSensitivity = 'SAFE' | 'SENSITIVE'

export interface ContextTask {
  title: string
  date: IsoDate | null
}

export interface ContextBlock {
  date: IsoDate
  title: string
  startTime: ClockTime
  endTime: ClockTime
}

export interface FreeWindow {
  date: IsoDate
  startTime: ClockTime
  endTime: ClockTime
}

export interface AssistantContext {
  today: IsoDate
  timezone: string
  city: string | null
  weekStartsOn: 0 | 1

  prayerTimes: { name: string; time: ClockTime }[]
  goals: string[]
  interests: string[]
  activeHabits: string[]
  upcomingTasks: ContextTask[]
  plannerBlocks: ContextBlock[]
  freeWindows: FreeWindow[]
}

export interface ContextOptions {
  /** How many days ahead to include. Chat needs less than a weekly planner. */
  days?: number
  /** Compute free windows. Only the planning generators need this. */
  includeFreeWindows?: boolean
}

/**
 * Build the safe context.
 *
 * There is deliberately no `includeSensitive` flag. A parameter that can turn
 * the guarantee off is a guarantee that will eventually be turned off by
 * accident; the sensitive tables are simply not queried here.
 */
export async function buildAssistantContext(
  actor: Actor,
  options: ContextOptions = {},
): Promise<AssistantContext> {
  const days = Math.min(Math.max(options.days ?? 7, 1), 21)
  const today = todayIn(actor.timezone)
  const horizon = addDays(today, days)

  const [preference, prayerSettings, habits, tasks, blocks] = await Promise.all([
    prisma.userPreference.findUnique({
      where: { userId: actor.userId },
      select: {
        goals: true,
        interests: true,
        weekStartsOn: true,
        city: { select: { name: true } },
      },
    }),

    getPrayerSettings(actor),

    // Names only. Never completion history — that is worship data.
    prisma.habit.findMany({
      where: { userId: actor.userId, active: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      take: 20,
      select: { name: true },
    }),

    // Titles and dates only. Never `description`, which is free text a member
    // may have written anything into.
    prisma.task.findMany({
      where: {
        userId: actor.userId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        OR: [
          { scheduledDate: { gte: isoDateToUtcDate(today), lte: isoDateToUtcDate(horizon) } },
          { scheduledDate: null },
        ],
      },
      orderBy: [{ scheduledDate: 'asc' }, { sortOrder: 'asc' }],
      take: 40,
      select: { title: true, scheduledDate: true },
    }),

    // Titles and times only. Never `note`.
    prisma.plannerBlock.findMany({
      where: {
        userId: actor.userId,
        deletedAt: null,
        localDate: { gte: isoDateToUtcDate(today), lte: isoDateToUtcDate(horizon) },
      },
      orderBy: [{ localDate: 'asc' }, { startTime: 'asc' }],
      take: 60,
      select: { title: true, localDate: true, startTime: true, endTime: true },
    }),
  ])

  const weekStartsOn = preference?.weekStartsOn === 0 ? 0 : 1

  const prayerTimes = prayerSettings
    ? computeForDay(prayerSettings, today).times.times.map((entry) => ({
        name: PRAYER_LABELS[entry.prayer].latin,
        time: instantToClockTime(entry.time, actor.timezone),
      }))
    : []

  const contextBlocks: ContextBlock[] = blocks.map((block) => ({
    date: utcDateToIsoDate(block.localDate),
    title: block.title,
    startTime: block.startTime,
    endTime: block.endTime,
  }))

  return {
    today,
    timezone: actor.timezone,
    city: preference?.city?.name ?? null,
    weekStartsOn,
    prayerTimes,
    goals: preference?.goals ?? [],
    interests: preference?.interests ?? [],
    activeHabits: habits.map((habit) => habit.name),
    upcomingTasks: tasks.map((task) => ({
      title: task.title,
      date: task.scheduledDate ? utcDateToIsoDate(task.scheduledDate) : null,
    })),
    plannerBlocks: contextBlocks,
    freeWindows: options.includeFreeWindows
      ? computeFreeWindows(today, days, contextBlocks, prayerSettings ? actor.timezone : null, prayerTimes)
      : [],
  }
}

/**
 * Free windows, computed deterministically before the model sees anything.
 *
 * The model is told where the gaps are rather than being asked to work them out.
 * Arithmetic over times is exactly what language models are worst at, and a plan
 * built on a miscalculated gap is worse than no plan.
 */
export function computeFreeWindows(
  today: IsoDate,
  days: number,
  blocks: ContextBlock[],
  timezone: string | null,
  prayerTimes: { name: string; time: ClockTime }[],
): FreeWindow[] {
  const DAY_START: ClockTime = '07:00'
  const DAY_END: ClockTime = '22:00'
  const MIN_WINDOW_MINUTES = 45

  const windows: FreeWindow[] = []

  // Prayer times only shift the boundaries of the first day; beyond that we do
  // not recompute per-day times here, so we stay honest and use the defaults.
  const fajr = prayerTimes.find((prayer) => prayer.name === 'Fajr')?.time
  const isha = prayerTimes.find((prayer) => prayer.name === 'Isha')?.time

  for (const date of rangeOfDays(today, addDays(today, days - 1))) {
    const dayBlocks = blocks
      .filter((block) => block.date === date)
      .map((block) => ({ start: toMinutes(block.startTime), end: toMinutes(block.endTime) }))
      .sort((a, b) => a.start - b.start)

    const start = date === today && fajr ? Math.max(toMinutes(fajr), toMinutes(DAY_START)) : toMinutes(DAY_START)
    const end = date === today && isha ? Math.min(toMinutes(isha), toMinutes(DAY_END)) : toMinutes(DAY_END)

    let cursor = start

    for (const block of dayBlocks) {
      if (block.start - cursor >= MIN_WINDOW_MINUTES) {
        windows.push({ date, startTime: fromMinutes(cursor), endTime: fromMinutes(block.start) })
      }
      cursor = Math.max(cursor, block.end)
    }

    if (end - cursor >= MIN_WINDOW_MINUTES) {
      windows.push({ date, startTime: fromMinutes(cursor), endTime: fromMinutes(end) })
    }
  }

  // Cap it: forty windows is plenty of signal and keeps the prompt small.
  return windows.slice(0, 40)
}

function fromMinutes(minutes: number): ClockTime {
  const normalised = Math.max(0, Math.min(1439, minutes))
  const hours = Math.floor(normalised / 60)
  const mins = normalised % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
