import 'server-only'

import type { Prayer, PrayerStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { isoDateToUtcDate, toIsoDateIn, todayIn, type IsoDate } from '@/lib/dates'
import { pickDeterministic } from '@/lib/utils'
import { PRAYER_LABELS, type Prayer as PrayerName } from '@/lib/prayer/types'
import {
  dayPartForMinutes,
  instantToClockTime,
  timelineMinutes,
  toMinutes,
  type ClockTime,
  type DayPart,
} from '@/lib/planner/time'
import {
  computeForDay,
  getPrayerLogsForDay,
  getPrayerSettings,
  isCompleted,
  type PrayerSettings,
} from '@/server/modules/prayer/prayer.service'
import {
  getHabitsForDay,
  habitsVisibleOn,
  type HabitDayState,
} from '@/server/modules/habits/habit.service'
import { listToday, type TaskView } from '@/server/modules/planner/task.service'
import { listBlocksForDay, type BlockView } from '@/server/modules/planner/planner-block.service'
import { getReflection, type ReflectionView } from '@/server/modules/reflection/reflection.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

/**
 * My Day — the composition service behind the app's primary screen.
 *
 * The page calls this one function. It never reaches into six repositories, and
 * it never triggers an N+1: every independent read below runs concurrently in a
 * single `Promise.all`, and each is a single indexed query on
 * `(userId, <date column>)`.
 *
 * Query budget: 8 round trips, all parallel except the prayer log (which needs
 * to know whether a location exists first).
 */

export interface MyDayPrayer {
  prayer: PrayerName
  label: string
  arabic: string
  /** Local wall-clock time, "HH:mm". */
  time: ClockTime
  startsAt: Date
  status: PrayerStatus | null
  logged: boolean
  isNext: boolean
  isPast: boolean
  /**
   * True when this prayer falls after local midnight and therefore belongs to
   * the END of this day rather than the start. Happens for Isha at northern
   * latitudes in summer.
   */
  afterMidnight: boolean
}

export interface MyDayNextPrayer {
  prayer: PrayerName
  label: string
  startsAt: Date
  minutesUntil: number
  isTomorrow: boolean
  windowProgress: number
}

interface TimelineBase {
  at: ClockTime
  /** Minutes from the start of the displayed day; may exceed 1440. */
  sortMinutes: number
  afterMidnight: boolean
}

export type TimelineEntry =
  | (TimelineBase & { kind: 'PRAYER'; prayer: PrayerName; label: string; logged: boolean })
  | (TimelineBase & { kind: 'BLOCK'; endsAt: ClockTime; block: BlockView })
  | (TimelineBase & { kind: 'TASK'; task: TaskView })

export interface MyDaySection {
  part: DayPart
  entries: TimelineEntry[]
}

export interface MyDayReminder {
  type: 'VERSE' | 'HADITH' | 'DUA'
  arabic: string | null
  translation: string
  reference: string
}

export interface MyDayData {
  date: IsoDate
  timezone: string
  locale: string
  cityName: string | null
  isJumuah: boolean

  /** `null` when the user has not set a location yet. */
  nextPrayer: MyDayNextPrayer | null
  prayers: MyDayPrayer[]
  prayersLogged: number

  priorities: TaskView[]
  tasks: TaskView[]
  tasksCompleted: number

  habits: HabitDayState[]
  habitsCompleted: number
  habitsDue: number

  blocks: BlockView[]
  timeline: MyDaySection[]

  reflection: ReflectionView | null
  reminder: MyDayReminder | null

  /** Free-tier context, so the UI can show the cap without a second query. */
  activeHabitCount: number
}

export async function getMyDay(
  actor: Actor,
  date: IsoDate = todayIn(actor.timezone),
  now: Date = new Date(),
): Promise<MyDayData> {
  const [preference, prayerSettings, habitStates, tasks, blocks, reflection, content] =
    await Promise.all([
      prisma.userPreference.findUnique({
        where: { userId: actor.userId },
        select: { weekStartsOn: true, city: { select: { name: true } } },
      }),
      getPrayerSettings(actor),
      getHabitsForDay(actor, date, 1),
      listToday(actor, date),
      listBlocksForDay(actor, date),
      getReflection(actor, date),
      prisma.dailyContent.findMany({
        where: { isActive: true, locale: actor.locale },
        select: { type: true, arabic: true, translation: true, reference: true },
      }),
    ])

  const weekStartsOn = preference?.weekStartsOn === 0 ? 0 : 1
  const prayerLogs = prayerSettings ? await getPrayerLogsForDay(actor, date) : {}

  const { prayers, nextPrayer, isJumuah } = buildPrayers(
    prayerSettings,
    date,
    actor.timezone,
    prayerLogs,
    now,
  )

  const visibleHabits =
    weekStartsOn === 1 ? habitsVisibleOn(habitStates, date) : habitsVisibleOn(habitStates, date)

  const priorities = tasks.filter((task) => task.isDailyPriority)

  const anchors = {
    dhuhr: prayers.find((p) => p.prayer === 'DHUHR')?.time,
    maghrib: prayers.find((p) => p.prayer === 'MAGHRIB')?.time,
  }

  await track(actor.userId, ANALYTICS_EVENTS.MY_DAY_OPENED, {
    habitCount: visibleHabits.length,
    taskCount: tasks.length,
    hasLocation: prayerSettings !== null,
  })

  const reminder = pickDeterministic(content, `${actor.userId}:${date}`) ?? null

  return {
    date,
    timezone: actor.timezone,
    locale: actor.locale,
    cityName: preference?.city?.name ?? null,
    isJumuah,

    nextPrayer,
    prayers,
    prayersLogged: prayers.filter((prayer) => prayer.logged).length,

    priorities,
    tasks,
    tasksCompleted: tasks.filter((task) => task.status === 'COMPLETED').length,

    habits: visibleHabits,
    habitsCompleted: visibleHabits.filter((state) => state.status === 'COMPLETED').length,
    habitsDue: visibleHabits.filter((state) => state.scheduled).length,

    blocks,
    timeline: buildTimeline(prayers, blocks, tasks, anchors),

    reflection,
    reminder: reminder
      ? {
          type: reminder.type,
          arabic: reminder.arabic,
          translation: reminder.translation,
          reference: reminder.reference,
        }
      : null,

    activeHabitCount: habitStates.length,
  }
}

// ─── Prayers ─────────────────────────────────────────────────────────────────

function buildPrayers(
  settings: PrayerSettings | null,
  date: IsoDate,
  timezone: string,
  logs: Partial<Record<Prayer, PrayerStatus>>,
  now: Date,
): { prayers: MyDayPrayer[]; nextPrayer: MyDayNextPrayer | null; isJumuah: boolean } {
  if (!settings) return { prayers: [], nextPrayer: null, isJumuah: false }

  const day = computeForDay(settings, date, now)
  const next = day.next

  const prayers: MyDayPrayer[] = day.times.times.map((entry) => {
    const status = logs[entry.prayer] ?? null
    const isNext = entry.prayer === next.prayer && !next.isTomorrow

    return {
      prayer: entry.prayer,
      // On Friday, Dhuhr is presented as Jumu'ah — the same prayer under the
      // name it is prayed by, never an additional sixth entry.
      label:
        day.isJumuah && entry.prayer === 'DHUHR'
          ? "Jumu'ah"
          : PRAYER_LABELS[entry.prayer].latin,
      arabic: day.isJumuah && entry.prayer === 'DHUHR' ? 'الجمعة' : PRAYER_LABELS[entry.prayer].arabic,
      time: instantToClockTime(entry.time, timezone),
      startsAt: entry.time,
      status,
      logged: isCompleted(status),
      isNext,
      isPast: entry.time.getTime() <= now.getTime(),
      // At the summer solstice in Brussels, Isha lands around 01:45 on the NEXT
      // calendar day. It still belongs to this day's five prayers.
      afterMidnight: toIsoDateIn(entry.time, timezone) !== date,
    }
  })

  return {
    prayers,
    nextPrayer: {
      prayer: next.prayer,
      label:
        day.isJumuah && next.prayer === 'DHUHR' ? "Jumu'ah" : PRAYER_LABELS[next.prayer].latin,
      startsAt: next.time,
      minutesUntil: Math.max(0, Math.ceil(next.msRemaining / 60_000)),
      isTomorrow: next.isTomorrow,
      windowProgress: next.windowProgress,
    },
    isJumuah: day.isJumuah,
  }
}

// ─── Timeline ────────────────────────────────────────────────────────────────

/**
 * The day as a single ordered list, grouped into morning / afternoon / evening.
 *
 * Prayer times are the anchors: they are injected from the calculation rather
 * than stored, so they stay correct if the user changes calculation method, and
 * they cannot drift from the times shown at the top of the screen.
 *
 * Boundaries follow Dhuhr and Maghrib when known, so "afternoon" means what it
 * means in the user's day rather than what a fixed clock says.
 */
function buildTimeline(
  prayers: MyDayPrayer[],
  blocks: BlockView[],
  tasks: TaskView[],
  anchors: { dhuhr?: ClockTime; maghrib?: ClockTime },
): MyDaySection[] {
  const entries: TimelineEntry[] = [
    ...prayers.map(
      (prayer): TimelineEntry => ({
        kind: 'PRAYER',
        at: prayer.time,
        sortMinutes: timelineMinutes(prayer.time, prayer.afterMidnight),
        afterMidnight: prayer.afterMidnight,
        prayer: prayer.prayer,
        label: prayer.label,
        logged: prayer.logged,
      }),
    ),
    ...blocks.map(
      (block): TimelineEntry => ({
        kind: 'BLOCK',
        at: block.startTime,
        sortMinutes: toMinutes(block.startTime),
        afterMidnight: false,
        endsAt: block.endTime,
        block,
      }),
    ),
    // Only timed tasks belong on a timeline; untimed ones live in the task list.
    ...tasks
      .filter((task) => task.scheduledTime !== null)
      .map(
        (task): TimelineEntry => ({
          kind: 'TASK',
          at: task.scheduledTime!,
          sortMinutes: toMinutes(task.scheduledTime!),
          afterMidnight: false,
          task,
        }),
      ),
  ]

  // Sorted on minutes-from-day-start, not on the "HH:mm" string: an Isha at
  // 01:45 must land at the END of the day, never above Fajr.
  entries.sort((a, b) => a.sortMinutes - b.sortMinutes)

  const sections: Record<DayPart, TimelineEntry[]> = {
    MORNING: [],
    AFTERNOON: [],
    EVENING: [],
  }

  for (const entry of entries) {
    sections[dayPartForMinutes(entry.sortMinutes, anchors)].push(entry)
  }

  return (['MORNING', 'AFTERNOON', 'EVENING'] as const)
    .map((part) => ({ part, entries: sections[part] }))
    .filter((section) => section.entries.length > 0)
}

// ─── Daily summary cache ─────────────────────────────────────────────────────

/**
 * Recompute the denormalised summary for one day.
 *
 * Per-domain counts only — no combined score. Collapsing prayer, habits and
 * tasks into one number would be a faith score, which this product does not do.
 */
export async function recomputeDailySummary(actor: Actor, date: IsoDate): Promise<void> {
  const day = isoDateToUtcDate(date)

  const [prayersLogged, prayersExcused, habitStates, taskCounts, reflection] = await Promise.all([
    prisma.prayerLog.count({
      where: { userId: actor.userId, date: day, status: { in: ['ON_TIME', 'LATE', 'JAMAAH'] } },
    }),
    prisma.prayerLog.count({ where: { userId: actor.userId, date: day, status: 'EXCUSED' } }),
    getHabitsForDay(actor, date, 1),
    prisma.task.groupBy({
      by: ['status'],
      where: { userId: actor.userId, scheduledDate: day, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.dailyReflection.count({ where: { userId: actor.userId, localDate: day } }),
  ])

  const visible = habitsVisibleOn(habitStates, date)
  const tasksPlanned = taskCounts.reduce((total, row) => total + row._count._all, 0)
  const tasksCompleted =
    taskCounts.find((row) => row.status === 'COMPLETED')?._count._all ?? 0

  const data = {
    prayersLogged,
    prayersExcused,
    habitsCompleted: visible.filter((state) => state.status === 'COMPLETED').length,
    habitsDue: visible.filter((state) => state.scheduled).length,
    tasksCompleted,
    tasksPlanned,
    hasReflection: reflection > 0,
  }

  await prisma.dailySummary.upsert({
    where: { userId_date: { userId: actor.userId, date: day } },
    create: { userId: actor.userId, date: day, ...data },
    update: data,
  })
}
