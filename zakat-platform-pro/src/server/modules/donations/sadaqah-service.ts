import 'server-only'

import type { SadaqahGoal, SadaqahPeriod } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertCanTagHousehold, assertOwner, visibleTo } from '@/server/auth/scope'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { sumMinor, toMinorUnits } from '@/lib/money'
import { SadaqahGoalNotFoundError } from '@/server/modules/donations/errors'
import type {
  SadaqahGoalCreatePayload,
  SadaqahGoalUpdatePayload,
} from '@/modules/donations/schemas'

/**
 * Sadaqah goals and progress (§9–§12).
 *
 * Voluntary giving is tracked entirely separately from the Zakat obligation:
 * `SADAQAH_TYPES` is the only set that counts here, so a Zakat payment can never
 * make a Sadaqah goal look met, and vice versa.
 *
 * Progress is a plain fraction — "€35 van €50". There are no streaks, no
 * failure states and no nudges (§12). Charity is not a habit tracker, and
 * pressuring someone about it would be worse than not tracking it at all.
 */

/** Only voluntary giving counts towards a Sadaqah goal. */
export const SADAQAH_TYPES = ['SADAQAH', 'SADAQAH_JARIYAH'] as const

export interface SadaqahGoalView {
  id: string
  label: string | null
  targetMinor: number
  currency: string
  period: SadaqahPeriod
  startDate: Date
  endDate: Date | null
  active: boolean
  archivedAt: Date | null
  householdId: string | null
  editable: boolean
}

export interface SadaqahGoalProgress extends SadaqahGoalView {
  achievedMinor: number
  remainingMinor: number
  /** 0–100, capped. Exceeding the goal is fine; a 340% bar is just noise. */
  percentage: number
  periodStart: Date
  periodEnd: Date
  donationCount: number
  /** True once the target is reached — stated plainly, never celebrated at the user. */
  reached: boolean
}

function toView(row: SadaqahGoal, actor: Actor): SadaqahGoalView {
  return {
    id: row.id,
    label: row.label,
    targetMinor: toMinorUnits(row.amount, row.currency),
    currency: row.currency,
    period: row.period,
    startDate: row.startDate,
    endDate: row.endDate,
    active: row.active,
    archivedAt: row.archivedAt,
    householdId: row.householdId,
    editable: row.userId === actor.userId,
  }
}

// ── Period maths ─────────────────────────────────────────────────────────────

export interface Window {
  start: Date
  end: Date
}

/**
 * The window a goal is currently being measured over.
 *
 * Anchored to `now` rather than to the goal's start date, so a monthly goal
 * created in January measures August in August. A goal that has ended, or has
 * not started yet, reports its own boundary instead — progress against a period
 * the user is not in would be misleading.
 */
export function currentWindow(
  period: SadaqahPeriod,
  startDate: Date,
  endDate: Date | null,
  now: Date = new Date(),
): Window {
  const reference = clamp(now, startDate, endDate)

  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()
  const day = reference.getUTCDate()

  let window: Window

  switch (period) {
    case 'DAILY':
      window = {
        start: new Date(Date.UTC(year, month, day)),
        end: new Date(Date.UTC(year, month, day + 1)),
      }
      break

    case 'WEEKLY': {
      // ISO weeks start on Monday; getUTCDay() is 0 for Sunday.
      const weekday = (reference.getUTCDay() + 6) % 7
      const monday = new Date(Date.UTC(year, month, day - weekday))
      window = { start: monday, end: new Date(Date.UTC(year, month, day - weekday + 7)) }
      break
    }

    case 'MONTHLY':
      window = {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month + 1, 1)),
      }
      break

    case 'YEARLY':
      window = {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
      }
      break
  }

  // Never measure outside the goal's own lifetime.
  return {
    start: window.start < startDate ? startDate : window.start,
    end: endDate && window.end > endDate ? endDate : window.end,
  }
}

function clamp(value: Date, min: Date, max: Date | null): Date {
  if (value < min) return min
  if (max && value > max) return max
  return value
}

// ── Reading ──────────────────────────────────────────────────────────────────

export async function listSadaqahGoals(
  actor: Actor,
  options: { includeArchived?: boolean } = {},
): Promise<SadaqahGoalView[]> {
  const rows = await prisma.sadaqahGoal.findMany({
    where: {
      ...visibleTo(actor),
      ...(options.includeArchived ? {} : { active: true }),
    },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  })

  return rows.map((row) => toView(row, actor))
}

/**
 * Deterministic progress for one goal (§11).
 *
 * Counts only: Sadaqah types, active (non-voided) donations, the goal's own
 * currency, inside the current window, and within the actor's visibility scope.
 */
export async function getSadaqahGoalProgress(
  actor: Actor,
  goalId: string,
  now: Date = new Date(),
): Promise<SadaqahGoalProgress> {
  const goal = await prisma.sadaqahGoal.findFirst({ where: { id: goalId, ...visibleTo(actor) } })
  if (!goal) throw new SadaqahGoalNotFoundError()

  return progressFor(goal, actor, now)
}

export async function listSadaqahGoalProgress(
  actor: Actor,
  now: Date = new Date(),
): Promise<SadaqahGoalProgress[]> {
  const goals = await prisma.sadaqahGoal.findMany({
    where: { ...visibleTo(actor), active: true },
    orderBy: { createdAt: 'desc' },
  })

  return Promise.all(goals.map((goal) => progressFor(goal, actor, now)))
}

async function progressFor(
  goal: SadaqahGoal,
  actor: Actor,
  now: Date,
): Promise<SadaqahGoalProgress> {
  const view = toView(goal, actor)
  const window = currentWindow(goal.period, goal.startDate, goal.endDate, now)

  const donations = await prisma.donation.findMany({
    where: {
      // A goal is personal: only the owner's own giving counts towards it, even
      // when the goal is shared into a household for visibility.
      userId: goal.userId,
      status: 'ACTIVE',
      type: { in: [...SADAQAH_TYPES] },
      currency: goal.currency,
      donatedAt: { gte: window.start, lt: window.end },
    },
    select: { amount: true, currency: true },
  })

  const achievedMinor = sumMinor(
    donations.map((d) => toMinorUnits(d.amount, d.currency)),
  )

  return {
    ...view,
    achievedMinor,
    remainingMinor: Math.max(0, view.targetMinor - achievedMinor),
    percentage:
      view.targetMinor === 0
        ? 0
        : Math.min(100, Math.round((achievedMinor / view.targetMinor) * 100)),
    periodStart: window.start,
    periodEnd: window.end,
    donationCount: donations.length,
    reached: achievedMinor >= view.targetMinor,
  }
}

// ── Writing ──────────────────────────────────────────────────────────────────

export async function createSadaqahGoal(
  actor: Actor,
  input: SadaqahGoalCreatePayload,
): Promise<SadaqahGoalView> {
  const row = await prisma.sadaqahGoal.create({
    data: {
      userId: actor.userId,
      householdId: assertCanTagHousehold(actor, input.householdId ?? null),
      label: input.label ?? null,
      amount: input.amount,
      currency: input.currency,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'SADAQAH_GOAL_CREATED',
    entityType: 'SadaqahGoal',
    entityId: row.id,
    metadata: { period: row.period, currency: row.currency },
  })

  trackEvent('SADAQAH_GOAL_CREATED', actor.userId, {
    period: row.period,
    currency: row.currency,
  })

  return toView(row, actor)
}

export async function updateSadaqahGoal(
  actor: Actor,
  id: string,
  input: SadaqahGoalUpdatePayload,
): Promise<SadaqahGoalView> {
  const existing = await prisma.sadaqahGoal.findUnique({ where: { id } })
  assertOwner(actor, existing)

  const row = await prisma.sadaqahGoal.update({
    where: { id },
    data: {
      householdId: assertCanTagHousehold(actor, input.householdId ?? null),
      label: input.label ?? null,
      amount: input.amount,
      currency: input.currency,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      active: input.active ?? existing?.active ?? true,
    },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'SADAQAH_GOAL_UPDATED',
    entityType: 'SadaqahGoal',
    entityId: row.id,
    metadata: { period: row.period, currency: row.currency },
  })

  return toView(row, actor)
}

/** Archive rather than delete, so past periods stay explainable. */
export async function archiveSadaqahGoal(actor: Actor, id: string): Promise<SadaqahGoalView> {
  const existing = await prisma.sadaqahGoal.findUnique({ where: { id } })
  assertOwner(actor, existing)
  if (!existing) throw new SadaqahGoalNotFoundError()

  const row = await prisma.sadaqahGoal.update({
    where: { id },
    data: { active: false, archivedAt: new Date() },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'SADAQAH_GOAL_ARCHIVED',
    entityType: 'SadaqahGoal',
    entityId: row.id,
  })

  return toView(row, actor)
}
