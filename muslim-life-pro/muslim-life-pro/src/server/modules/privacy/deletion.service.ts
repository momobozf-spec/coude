import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { DeletionStatus, Prisma } from '@prisma/client'

import { ForbiddenError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { grantsAccess } from '@/server/modules/billing/access-policy'
import { dispatchNotification } from '@/server/modules/notifications/notification.service'
import { writeAudit } from '@/server/services/audit'

/**
 * Erasure (GDPR art. 17).
 *
 * Two separate operations, because they answer two different questions:
 *
 *  - `clearActivity()` — "I want to start over." The account stays.
 *  - `requestAccountDeletion()` → `completeAccountDeletion()` — "I want to leave."
 *
 * Account deletion is staged rather than immediate. A single destructive call
 * has two problems: a member who mis-clicks has no recourse, and an account with
 * a live subscription would vanish while the payment provider carries on
 * charging a card nobody can now trace back to a person. So the request is
 * recorded, billing is checked, sessions are revoked immediately, and the
 * irreversible part runs after a grace window.
 */

/** How long a member has to change their mind. */
export const DELETION_GRACE_DAYS = 14

// ─────────────────────────────────────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────────────────────────────────────

export interface ClearActivityResult {
  deleted: Record<string, number>
  total: number
}

/**
 * Remove everything the member has tracked, keeping the account.
 *
 * Preferences, subscription and identity survive — this is "clear my history",
 * not "delete me". Runs in one transaction so a partial clear cannot leave, say,
 * habits without their logs.
 */
export async function clearActivity(actor: Actor): Promise<ClearActivityResult> {
  const userId = actor.userId

  const deleted = await prisma.$transaction(async (tx) => {
    // Order matters where a cascade does not cover it: logs reference habits.
    const habitLogs = await tx.habitLog.deleteMany({ where: { userId } })
    const prayerLogs = await tx.prayerLog.deleteMany({ where: { userId } })
    const summaries = await tx.dailySummary.deleteMany({ where: { userId } })
    const reflections = await tx.dailyReflection.deleteMany({ where: { userId } })
    const plannerBlocks = await tx.plannerBlock.deleteMany({ where: { userId } })
    const tasks = await tx.task.deleteMany({ where: { userId } })
    const habits = await tx.habit.deleteMany({ where: { userId } })
    const goals = await tx.goal.deleteMany({ where: { userId } })

    return {
      habitLogs: habitLogs.count,
      prayerLogs: prayerLogs.count,
      dailySummaries: summaries.count,
      reflections: reflections.count,
      plannerBlocks: plannerBlocks.count,
      tasks: tasks.count,
      habits: habits.count,
      goals: goals.count,
    }
  })

  const total = Object.values(deleted).reduce((sum, count) => sum + count, 0)

  await writeAudit({
    actorId: userId,
    action: 'ACTIVITY_DELETED',
    entityType: 'User',
    entityId: userId,
    // Counts only. What was in a reflection is exactly what must not be here.
    metadata: { total },
  })

  logger.info('privacy.activity.cleared', { total })

  return { deleted, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account deletion
// ─────────────────────────────────────────────────────────────────────────────

export interface DeletionState {
  status: DeletionStatus
  requestedAt: Date | null
  /** When the irreversible step becomes due. */
  scheduledFor: Date | null
  /** Set when billing is what stands in the way. */
  blockedReason: 'ACTIVE_SUBSCRIPTION' | null
}

export async function getDeletionState(
  actor: Actor,
  now: Date = new Date(),
): Promise<DeletionState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: {
      deletionStatus: true,
      deletionRequestedAt: true,
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  })

  const blocked = user.subscription && grantsAccess(user.subscription, now)

  return {
    status: user.deletionStatus,
    requestedAt: user.deletionRequestedAt,
    scheduledFor: user.deletionRequestedAt ? addDays(user.deletionRequestedAt, DELETION_GRACE_DAYS) : null,
    blockedReason: blocked ? 'ACTIVE_SUBSCRIPTION' : null,
  }
}

/**
 * Record a deletion request.
 *
 * Idempotent: asking twice does not restart the clock or send a second notice.
 */
export async function requestAccountDeletion(
  actor: Actor,
  confirmation: string,
  now: Date = new Date(),
): Promise<DeletionState> {
  if (confirmation.trim().toUpperCase() !== 'DELETE') {
    throw new ValidationError('Type DELETE to confirm.')
  }

  const state = await getDeletionState(actor, now)

  if (state.status === 'COMPLETED') {
    throw new ForbiddenError('This account has already been deleted.')
  }

  // Never delete an account while a provider can still charge it. Cancelling is
  // the member's decision to make, not something to do on their behalf.
  if (state.blockedReason === 'ACTIVE_SUBSCRIPTION') {
    await prisma.user.update({
      where: { id: actor.userId },
      data: { deletionStatus: 'BLOCKED_BILLING' },
    })
    throw new ForbiddenError(
      'Cancel your paid subscription first. We will not delete an account that a payment provider can still charge.',
    )
  }

  if (state.status === 'REQUESTED') return state

  await prisma.user.update({
    where: { id: actor.userId },
    data: { deletionStatus: 'REQUESTED', deletionRequestedAt: now },
  })

  // Every session, everywhere, immediately. The grace window is for changing
  // your mind by signing in again — not for a forgotten device to stay logged in.
  await revokeSessions(actor.userId)

  await writeAudit({
    actorId: actor.userId,
    action: 'ACCOUNT_DELETION_REQUESTED',
    entityType: 'User',
    entityId: actor.userId,
    metadata: { graceDays: DELETION_GRACE_DAYS },
  })

  // Sent before the status is anything final, so the dispatcher's
  // "don't message departed members" guard does not swallow it.
  await dispatchNotification({
    userId: actor.userId,
    type: 'ACCOUNT_DELETION_REQUESTED',
    occurrence: now.toISOString().slice(0, 10),
    variables: { graceDays: DELETION_GRACE_DAYS },
  })

  logger.info('privacy.deletion.requested')

  return getDeletionState(actor, now)
}

/** Withdraw a pending request. Only possible before the policy has run. */
export async function cancelAccountDeletion(actor: Actor): Promise<DeletionState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { deletionStatus: true },
  })

  if (user.deletionStatus === 'COMPLETED') {
    throw new ForbiddenError('This account has already been deleted.')
  }

  await prisma.user.update({
    where: { id: actor.userId },
    data: { deletionStatus: 'NONE', deletionRequestedAt: null },
  })

  await writeAudit({
    actorId: actor.userId,
    action: 'ACCOUNT_DELETION_CANCELLED',
    entityType: 'User',
    entityId: actor.userId,
  })

  return getDeletionState(actor)
}

export interface CompletionResult {
  completed: boolean
  reason?: 'NOT_REQUESTED' | 'GRACE_PERIOD' | 'BLOCKED_BILLING' | 'ALREADY_COMPLETED'
  deleted: Record<string, number>
  anonymized: Record<string, number>
}

/**
 * Run the deletion policy.
 *
 * Called by the scheduled job once the grace window has passed, and directly in
 * tests. Idempotent: a second run on a completed account is a no-op, so a retry
 * after a partial failure is safe.
 *
 * `force` skips only the grace window — never the billing guard.
 */
export async function completeAccountDeletion(
  userId: string,
  options: { now?: Date; force?: boolean } = {},
): Promise<CompletionResult> {
  const now = options.now ?? new Date()
  const empty = { deleted: {}, anonymized: {} }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      deletionStatus: true,
      deletionRequestedAt: true,
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  })

  if (!user) return { completed: false, reason: 'NOT_REQUESTED', ...empty }
  if (user.deletionStatus === 'COMPLETED') {
    return { completed: false, reason: 'ALREADY_COMPLETED', ...empty }
  }
  if (user.deletionStatus === 'NONE' || !user.deletionRequestedAt) {
    return { completed: false, reason: 'NOT_REQUESTED', ...empty }
  }

  if (user.subscription && grantsAccess(user.subscription, now)) {
    await prisma.user.update({ where: { id: userId }, data: { deletionStatus: 'BLOCKED_BILLING' } })
    return { completed: false, reason: 'BLOCKED_BILLING', ...empty }
  }

  if (!options.force && now < addDays(user.deletionRequestedAt, DELETION_GRACE_DAYS)) {
    return { completed: false, reason: 'GRACE_PERIOD', ...empty }
  }

  // The farewell goes out before the address is scrubbed — afterwards there is
  // nowhere to send it.
  await dispatchNotification({
    userId,
    type: 'ACCOUNT_DELETION_COMPLETED',
    occurrence: now.toISOString().slice(0, 10),
  }).catch((error) => {
    // A failed goodbye must not stop an erasure the member asked for.
    logger.warn('privacy.deletion.notice_failed', { error: String(error) })
  })

  const { deleted, anonymized } = await prisma.$transaction(async (tx) => {
    // ── DELETE ───────────────────────────────────────────────────────────────
    const deleted: Record<string, number> = {}

    deleted.sessions = (await tx.session.deleteMany({ where: { userId } })).count
    deleted.accounts = (await tx.account.deleteMany({ where: { userId } })).count
    // The user row is anonymised, not deleted, so its cascade never fires:
    // reset links are removed by name, like every other DELETE model.
    deleted.passwordResetTokens = (await tx.passwordResetToken.deleteMany({ where: { userId } })).count
    deleted.habitLogs = (await tx.habitLog.deleteMany({ where: { userId } })).count
    deleted.prayerLogs = (await tx.prayerLog.deleteMany({ where: { userId } })).count
    deleted.dailySummaries = (await tx.dailySummary.deleteMany({ where: { userId } })).count
    deleted.reflections = (await tx.dailyReflection.deleteMany({ where: { userId } })).count
    deleted.plannerBlocks = (await tx.plannerBlock.deleteMany({ where: { userId } })).count
    deleted.tasks = (await tx.task.deleteMany({ where: { userId } })).count
    deleted.habits = (await tx.habit.deleteMany({ where: { userId } })).count
    deleted.goals = (await tx.goal.deleteMany({ where: { userId } })).count
    deleted.favoriteBusinesses = (await tx.favoriteBusiness.deleteMany({ where: { userId } })).count
    deleted.favoriteDeals = (await tx.favoriteDeal.deleteMany({ where: { userId } })).count
    // Messages cascade from their conversation.
    deleted.assistantConversations = (await tx.aIConversation.deleteMany({ where: { userId } }))
      .count
    // Items cascade from their plan.
    deleted.generatedPlans = (await tx.generatedPlan.deleteMany({ where: { userId } })).count
    // Deliveries cascade from their notification.
    deleted.notifications = (await tx.notification.deleteMany({ where: { userId } })).count
    deleted.preferences = (await tx.userPreference.deleteMany({ where: { userId } })).count
    deleted.rateLimitEntries = 0 // Keyed by identifier string, pruned on its own schedule.

    // ── ANONYMIZE ────────────────────────────────────────────────────────────
    const anonymized: Record<string, number> = {}

    anonymized.analyticsEvents = (
      await tx.analyticsEvent.updateMany({ where: { userId }, data: { userId: null } })
    ).count

    // These have a non-nullable userId, so the link is severed by moving them to
    // a single tombstone account rather than by nulling the column. One row,
    // no personal fields, existing only to keep foreign keys valid.
    const tombstoneId = await ensureTombstone(tx)

    anonymized.redemptions = (
      await tx.dealRedemption.updateMany({ where: { userId }, data: { userId: tombstoneId } })
    ).count
    anonymized.assistantUsage = (
      await tx.aIUsage.updateMany({ where: { userId }, data: { userId: tombstoneId } })
    ).count

    // The subscription row stays attached to this user so a late webhook can
    // still be reconciled — but the provider identifiers go, so it can no longer
    // be used to look the person up at the provider.
    anonymized.subscriptions = (
      await tx.subscription.updateMany({
        where: { userId },
        data: { externalCustomerId: null, externalSubscriptionId: null },
      })
    ).count

    // ── The account row itself ───────────────────────────────────────────────
    // Kept, scrubbed. Deleting it would cascade into the retained records above
    // and would also lose the audit trail's foreign key. The email is replaced
    // by an irreversible digest so a duplicate-signup check still works without
    // storing the address.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${createHash('sha256').update(user.email).digest('hex').slice(0, 32)}@deleted.invalid`,
        name: null,
        image: null,
        passwordHash: null,
        emailVerified: null,
        locale: 'en',
        deletionStatus: 'COMPLETED',
        anonymizedAt: now,
        deletedAt: now,
        lastExportAt: null,
      },
    })

    return { deleted, anonymized }
  })

  await writeAudit({
    actorId: null,
    action: 'ACCOUNT_DELETED',
    entityType: 'User',
    entityId: userId,
    metadata: {
      deletedRows: Object.values(deleted).reduce((a, b) => a + b, 0),
      anonymizedRows: Object.values(anonymized).reduce((a, b) => a + b, 0),
    },
  })

  logger.info('privacy.deletion.completed')

  return { completed: true, deleted, anonymized }
}

/** Accounts whose grace window has elapsed. Input for the scheduled job. */
export async function listDueDeletions(now: Date = new Date(), limit = 100): Promise<string[]> {
  const cutoff = addDays(now, -DELETION_GRACE_DAYS)

  const users = await prisma.user.findMany({
    where: { deletionStatus: 'REQUESTED', deletionRequestedAt: { lte: cutoff } },
    select: { id: true },
    take: limit,
  })

  return users.map((user) => user.id)
}

// ─────────────────────────────────────────────────────────────────────────────

const TOMBSTONE_EMAIL = 'tombstone@deleted.invalid'

/**
 * The account that anonymised rows are reparented to.
 *
 * It holds no personal data and can never be signed into: `passwordHash` is
 * null, so credentials authentication has nothing to compare against, and
 * `deletionStatus` is COMPLETED, which `getActor` refuses outright.
 */
async function ensureTombstone(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.user.findUnique({
    where: { email: TOMBSTONE_EMAIL },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await tx.user.create({
    data: {
      id: randomUUID(),
      email: TOMBSTONE_EMAIL,
      name: null,
      passwordHash: null,
      deletionStatus: 'COMPLETED',
      anonymizedAt: new Date(),
      deletedAt: new Date(),
    },
    select: { id: true },
  })

  return created.id
}

async function revokeSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}
