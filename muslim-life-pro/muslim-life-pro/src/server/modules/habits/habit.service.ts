import 'server-only'

import type { HabitLogStatus, Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { limitsFor, requireEntitlement, withinLimit } from '@/server/services/entitlements'
import {
  endOfWeek,
  isoDateToUtcDate,
  startOfWeek,
  utcDateToIsoDate,
  type IsoDate,
} from '@/lib/dates'
import {
  expectedPerWeek,
  isAvailableOn,
  isScheduledOn,
  statusForQuantity,
  type HabitSchedule,
} from '@/lib/habits/schedule'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { findTemplate } from '@/server/modules/habits/habit-templates'

export const HABIT_CATEGORIES = [
  'WORSHIP',
  'HEALTH',
  'LEARNING',
  'FAMILY',
  'WORK',
  'CHARITY',
  'PERSONAL',
  'CUSTOM',
] as const

export const HABIT_TYPES = ['BOOLEAN', 'COUNTER', 'DURATION'] as const
export const FREQUENCY_TYPES = ['DAILY', 'SPECIFIC_DAYS', 'TIMES_PER_WEEK'] as const
export const TIME_OF_DAY = ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] as const

/**
 * Base shape, kept free of refinements so `.partial()` remains usable for
 * updates — zod rejects `.partial()` on a refined schema at runtime.
 */
const habitFields = z.object({
  name: z.string().trim().min(1, 'Give the habit a name.').max(120),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.enum(HABIT_CATEGORIES).default('PERSONAL'),
  icon: z.string().trim().max(40).default('circle'),
  color: z.string().trim().max(24).default('emerald'),
  type: z.enum(HABIT_TYPES).default('BOOLEAN'),
  targetValue: z.number().int().min(1).max(10_000).default(1),
  unit: z.string().trim().max(24).nullable().optional(),
  frequencyType: z.enum(FREQUENCY_TYPES).default('DAILY'),
  targetPerPeriod: z.number().int().min(1).max(7).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  preferredTimeOfDay: z.enum(TIME_OF_DAY).default('ANY'),
  templateKey: z.string().trim().max(60).nullable().optional(),
})

/** A weekday-scheduled habit with no weekdays chosen would never be due. */
export const createHabitSchema = habitFields.refine(
  (value) => value.frequencyType !== 'SPECIFIC_DAYS' || value.daysOfWeek.length > 0,
  { message: 'Pick at least one day of the week.', path: ['daysOfWeek'] },
)

export type CreateHabitInput = z.input<typeof createHabitSchema>

// Updates are patches, so the same rule is enforced in `updateHabit` against the
// merged result rather than against the partial input.
export const updateHabitSchema = habitFields.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>

export interface HabitView {
  id: string
  name: string
  description: string | null
  category: string
  icon: string
  color: string
  type: 'BOOLEAN' | 'COUNTER' | 'DURATION'
  targetValue: number
  unit: string | null
  frequencyType: 'DAILY' | 'SPECIFIC_DAYS' | 'TIMES_PER_WEEK'
  targetPerPeriod: number
  daysOfWeek: number[]
  preferredTimeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'
  active: boolean
  sortOrder: number
  isWorship: boolean
}

const HABIT_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  icon: true,
  color: true,
  type: true,
  targetValue: true,
  unit: true,
  frequencyType: true,
  targetPerPeriod: true,
  daysOfWeek: true,
  preferredTimeOfDay: true,
  active: true,
  sortOrder: true,
} satisfies Prisma.HabitSelect

type HabitRow = Prisma.HabitGetPayload<{ select: typeof HABIT_SELECT }>

/**
 * Worship habits get gentler feedback in the UI. This is the single place that
 * decides what counts as worship, so the rule cannot drift between screens.
 */
export function isWorshipCategory(category: string): boolean {
  return category === 'WORSHIP' || category === 'CHARITY'
}

export function toHabitView(habit: HabitRow): HabitView {
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    category: habit.category,
    icon: habit.icon,
    color: habit.color,
    type: habit.type,
    targetValue: habit.targetValue,
    unit: habit.unit,
    frequencyType: habit.frequencyType,
    targetPerPeriod: habit.targetPerPeriod,
    daysOfWeek: habit.daysOfWeek,
    preferredTimeOfDay: habit.preferredTimeOfDay,
    active: habit.active,
    sortOrder: habit.sortOrder,
    isWorship: isWorshipCategory(habit.category),
  }
}

export function scheduleOf(habit: HabitView): HabitSchedule {
  return {
    frequencyType: habit.frequencyType,
    daysOfWeek: habit.daysOfWeek,
    targetPerPeriod: habit.targetPerPeriod,
  }
}

const activeWhere = { active: true, deletedAt: null } as const

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listHabits(actor: Actor, includeInactive = false): Promise<HabitView[]> {
  const habits = await prisma.habit.findMany({
    where: {
      userId: actor.userId,
      deletedAt: null,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: HABIT_SELECT,
  })

  return habits.map(toHabitView)
}

/**
 * Active habit count for the free-tier cap.
 *
 * PrayerLog is a separate model entirely and is not reachable from here, so
 * prayers can never count against the habit limit. That is enforced by the data
 * model rather than by remembering to exclude them.
 */
export async function countActiveHabits(actor: Actor): Promise<number> {
  return prisma.habit.count({ where: { userId: actor.userId, ...activeWhere } })
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createHabit(actor: Actor, input: CreateHabitInput): Promise<HabitView> {
  const data = createHabitSchema.parse(input)

  const limits = limitsFor(actor)
  const current = await countActiveHabits(actor)

  requireEntitlement(actor, 'habits.unlimited', {
    unless: withinLimit(current, limits.maxHabits),
    message: `The free plan includes ${limits.maxHabits} active habits. Premium removes the limit.`,
  })

  const habit = await prisma.habit.create({
    data: {
      userId: actor.userId,
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      icon: data.icon,
      color: data.color,
      type: data.type,
      targetValue: data.targetValue,
      unit: data.unit ?? null,
      frequencyType: data.frequencyType,
      targetPerPeriod: data.targetPerPeriod,
      daysOfWeek: data.frequencyType === 'SPECIFIC_DAYS' ? data.daysOfWeek : [],
      preferredTimeOfDay: data.preferredTimeOfDay,
      isPreset: data.templateKey ?? null,
      sortOrder: current,
    },
    select: HABIT_SELECT,
  })

  await track(actor.userId, ANALYTICS_EVENTS.HABIT_CREATED, {
    fromTemplate: Boolean(data.templateKey),
    isWorship: isWorshipCategory(data.category),
    activeCount: current + 1,
  })

  return toHabitView(habit)
}

/** Create a habit from a template, so onboarding does not duplicate the defaults. */
export async function createHabitFromTemplate(
  actor: Actor,
  templateKey: string,
): Promise<HabitView> {
  const template = findTemplate(templateKey)
  if (!template) throw new NotFoundError('Habit template')

  return createHabit(actor, {
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    color: template.color,
    type: template.type,
    targetValue: template.targetValue,
    unit: template.unit,
    frequencyType: template.frequencyType,
    targetPerPeriod: template.targetPerPeriod,
    daysOfWeek: template.daysOfWeek,
    preferredTimeOfDay: template.preferredTimeOfDay,
    templateKey: template.key,
  })
}

export async function updateHabit(
  actor: Actor,
  habitId: string,
  input: UpdateHabitInput,
): Promise<HabitView> {
  const data = updateHabitSchema.parse(input)

  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId: actor.userId, deletedAt: null },
    select: { id: true, active: true, frequencyType: true, daysOfWeek: true },
  })
  if (!existing) throw new NotFoundError('Habit')

  // Validate the MERGED result, not just the patch: switching to SPECIFIC_DAYS
  // without supplying days would otherwise leave a habit that is never due.
  const frequencyType = data.frequencyType ?? existing.frequencyType
  const daysOfWeek = data.daysOfWeek ?? existing.daysOfWeek
  if (frequencyType === 'SPECIFIC_DAYS' && daysOfWeek.length === 0) {
    throw new ValidationError('Pick at least one day of the week.')
  }

  // Re-activating counts against the cap again.
  if (data.active === true && !existing.active) {
    const limits = limitsFor(actor)
    const current = await countActiveHabits(actor)
    requireEntitlement(actor, 'habits.unlimited', {
      unless: withinLimit(current, limits.maxHabits),
      message: `The free plan includes ${limits.maxHabits} active habits. Premium removes the limit.`,
    })
  }

  const habit = await prisma.habit.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.frequencyType !== undefined ? { frequencyType: data.frequencyType } : {}),
      ...(data.targetPerPeriod !== undefined ? { targetPerPeriod: data.targetPerPeriod } : {}),
      daysOfWeek: frequencyType === 'SPECIFIC_DAYS' ? daysOfWeek : [],
      ...(data.preferredTimeOfDay !== undefined
        ? { preferredTimeOfDay: data.preferredTimeOfDay }
        : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    select: HABIT_SELECT,
  })

  return toHabitView(habit)
}

/** Pause a habit. Its history is kept — pausing is not deleting. */
export async function setHabitActive(actor: Actor, habitId: string, active: boolean) {
  return updateHabit(actor, habitId, { active })
}

export async function deleteHabit(actor: Actor, habitId: string): Promise<void> {
  const { count } = await prisma.habit.updateMany({
    where: { id: habitId, userId: actor.userId, deletedAt: null },
    data: { deletedAt: new Date(), active: false },
  })
  if (count === 0) throw new NotFoundError('Habit')
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export interface LogHabitResult {
  habitId: string
  localDate: IsoDate
  status: HabitLogStatus | null
  quantity: number | null
}

/**
 * Record, change or clear a habit log for one local day.
 *
 * Upserted on `[habitId, localDate]`, so a double tap on a poor connection
 * cannot create two rows. Passing `status: null` clears the day entirely —
 * an un-tick is a removal, not a "failed" record.
 */
export async function logHabit(
  actor: Actor,
  habitId: string,
  localDate: IsoDate,
  input: { status: HabitLogStatus | null; quantity?: number | null },
): Promise<LogHabitResult> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: actor.userId, deletedAt: null },
    select: { id: true, type: true, targetValue: true, category: true },
  })
  if (!habit) throw new NotFoundError('Habit')

  const day = isoDateToUtcDate(localDate)

  if (input.status === null) {
    await prisma.habitLog.deleteMany({ where: { habitId: habit.id, localDate: day } })
    return { habitId: habit.id, localDate, status: null, quantity: null }
  }

  // For measured habits the quantity decides the status, so the two can never
  // contradict each other.
  let status = input.status
  let quantity: number | null = null

  if (habit.type !== 'BOOLEAN' && input.quantity !== undefined && input.quantity !== null) {
    quantity = Math.max(0, Math.trunc(input.quantity))

    if (input.status !== 'SKIPPED') {
      const derived = statusForQuantity(quantity, habit.targetValue)
      if (derived === null) {
        await prisma.habitLog.deleteMany({ where: { habitId: habit.id, localDate: day } })
        return { habitId: habit.id, localDate, status: null, quantity: null }
      }
      status = derived
    }
  } else if (habit.type !== 'BOOLEAN' && input.status === 'COMPLETED') {
    quantity = habit.targetValue
  }

  await prisma.habitLog.upsert({
    where: { habitId_localDate: { habitId: habit.id, localDate: day } },
    create: { habitId: habit.id, userId: actor.userId, localDate: day, status, quantity },
    update: { status, quantity },
  })

  const isWorship = isWorshipCategory(habit.category)
  if (status === 'SKIPPED') {
    await track(actor.userId, ANALYTICS_EVENTS.HABIT_SKIPPED, { isWorship })
  } else {
    await track(actor.userId, ANALYTICS_EVENTS.HABIT_COMPLETED, {
      isWorship,
      partial: status === 'PARTIAL',
    })
  }

  return { habitId: habit.id, localDate, status, quantity }
}

/** Convenience toggle used by the one-tap checkboxes. */
export async function toggleHabit(
  actor: Actor,
  habitId: string,
  localDate: IsoDate,
): Promise<LogHabitResult> {
  const existing = await prisma.habitLog.findFirst({
    where: { habitId, userId: actor.userId, localDate: isoDateToUtcDate(localDate) },
    select: { status: true },
  })

  // Completed → cleared. Anything else (partial, skipped, nothing) → completed.
  const next = existing?.status === 'COMPLETED' ? null : 'COMPLETED'
  return logHabit(actor, habitId, localDate, { status: next })
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface HabitDayState {
  habit: HabitView
  status: HabitLogStatus | null
  quantity: number | null
  /** Expected on this specific day (false for TIMES_PER_WEEK habits). */
  scheduled: boolean
  /** Completed days within the current week. */
  weekCompleted: number
  /** Days expected within a week. */
  weekExpected: number
}

/**
 * Habits for one day, with each habit's weekly context.
 *
 * Weekly context is what replaces streaks: "3 of 5 days this week" is
 * informative without implying that day four is a moral failure.
 */
export async function getHabitsForDay(
  actor: Actor,
  date: IsoDate,
  weekStartsOn: 0 | 1 = 1,
): Promise<HabitDayState[]> {
  const weekStart = startOfWeek(date, weekStartsOn)
  const weekEnd = endOfWeek(date, weekStartsOn)

  const habits = await prisma.habit.findMany({
    where: { userId: actor.userId, ...activeWhere },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      ...HABIT_SELECT,
      logs: {
        where: {
          localDate: { gte: isoDateToUtcDate(weekStart), lte: isoDateToUtcDate(weekEnd) },
        },
        select: { localDate: true, status: true, quantity: true },
      },
    },
  })

  return habits.map((row) => {
    const view = toHabitView(row)
    const schedule = scheduleOf(view)

    const today = row.logs.find((log) => utcDateToIsoDate(log.localDate) === date)
    const weekCompleted = row.logs.filter((log) => log.status === 'COMPLETED').length

    return {
      habit: view,
      status: today?.status ?? null,
      quantity: today?.quantity ?? null,
      scheduled: isScheduledOn(schedule, date),
      weekCompleted,
      weekExpected: expectedPerWeek(schedule),
    }
  })
}

/** Habits that should be surfaced on a given day. */
export function habitsVisibleOn(states: HabitDayState[], date: IsoDate): HabitDayState[] {
  return states.filter((state) => isAvailableOn(scheduleOf(state.habit), date))
}

export interface HabitWeekSummary {
  habitId: string
  name: string
  isWorship: boolean
  completed: number
  expected: number
}

/** Per-habit weekly counts for the habits page and the weekly review. */
export async function getWeeklySummaries(
  actor: Actor,
  date: IsoDate,
  weekStartsOn: 0 | 1 = 1,
): Promise<HabitWeekSummary[]> {
  const states = await getHabitsForDay(actor, date, weekStartsOn)

  return states.map((state) => ({
    habitId: state.habit.id,
    name: state.habit.name,
    isWorship: state.habit.isWorship,
    completed: state.weekCompleted,
    expected: state.weekExpected,
  }))
}
