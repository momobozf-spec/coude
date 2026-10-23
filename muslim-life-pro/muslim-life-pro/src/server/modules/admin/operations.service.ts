import 'server-only'

import { requireAdmin } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { getAnalyticsStatus } from '@/server/integrations/analytics'
import { getNotificationsStatus } from '@/server/integrations/notifications'
import { getPaymentsStatus } from '@/server/integrations/payments'
import {
  listReconciliationCandidates,
  reconcileSubscription,
} from '@/server/modules/billing/reconcile.service'
import { enforce } from '@/server/services/rate-limit'
import { writeAudit } from '@/server/services/audit'

/**
 * Operational metrics for administrators.
 *
 * Every figure here is a count or a status. There is deliberately nothing that
 * would let an administrator read a member's life: no habit names, no
 * reflections, no assistant conversations, no card details, no amounts owed by
 * an individual, no prayer records.
 *
 * That is not squeamishness — it is the same promise the marketing page makes
 * ("your worship is never public"). A support tool that quietly exempts staff
 * from it would make that sentence false.
 */

export interface OperationalMetrics {
  members: number
  activeSubscriptions: number
  trialing: number
  pastDue: number
  webhooksLastDay: number
  webhookFailuresLastDay: number
  pendingDeletions: number
  failedDeliveries: number
  generatedAt: Date
}

export interface IntegrationStatuses {
  payments: { providerId: string; configured: boolean; isStub: boolean | null }
  analytics: { providerId: string; sinkId: string }
  notifications: { providerId: string; isStub: boolean; externalChannels: readonly string[] }
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  const admin = await requireAdmin()

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [members, activeSubscriptions, trialing, pastDue, webhooks, webhookFailures, pendingDeletions, failedDeliveries] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.subscription.count({ where: { plan: 'PREMIUM', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }),
      prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
      prisma.webhookEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.webhookEvent.count({ where: { createdAt: { gte: dayAgo }, error: { not: null } } }),
      prisma.user.count({ where: { deletionStatus: { in: ['REQUESTED', 'BLOCKED_BILLING'] } } }),
      prisma.notificationDelivery.count({ where: { status: 'FAILED' } }),
    ])

  // Reading the panel is itself recorded. An administrator's access to
  // aggregate member data should leave a trace, even when nothing changed.
  await writeAudit({
    actorId: admin.userId,
    action: 'ADMIN_METRICS_VIEWED',
    entityType: 'Operations',
  })

  return {
    members,
    activeSubscriptions,
    trialing,
    pastDue,
    webhooksLastDay: webhooks,
    webhookFailuresLastDay: webhookFailures,
    pendingDeletions,
    failedDeliveries,
    generatedAt: now,
  }
}

export async function getIntegrationStatuses(): Promise<IntegrationStatuses> {
  await requireAdmin()

  const payments = getPaymentsStatus()
  const notifications = getNotificationsStatus()

  return {
    payments: {
      providerId: payments.providerId,
      configured: payments.configured,
      isStub: payments.configured ? payments.isStub : null,
    },
    analytics: getAnalyticsStatus(),
    notifications: {
      providerId: notifications.providerId,
      isStub: notifications.isStub,
      externalChannels: notifications.externalChannels,
    },
  }
}

export interface ReconciliationCandidate {
  userId: string
  /** Enough to identify the row for support, without naming the member. */
  reference: string
  status: string
  lastSyncedAt: Date | null
}

export async function listReconciliationQueue(limit = 25): Promise<ReconciliationCandidate[]> {
  await requireAdmin()

  const candidates = await listReconciliationCandidates(limit)

  return candidates.map((candidate) => ({
    userId: candidate.userId,
    // The last segment of the internal id. Enough to match two screens against
    // each other; not enough to identify a person.
    reference: candidate.userId.slice(-8),
    status: candidate.status,
    lastSyncedAt: candidate.providerUpdatedAt ?? null,
  }))
}

/**
 * Re-read a subscription from the provider and apply its answer.
 *
 * Goes through the same `reconcileSubscription` the scheduled job uses. There is
 * no admin-only write path: an operator pressing a button and a cron job at
 * 3am must produce identical state, or the button becomes a way to create
 * subscriptions that no webhook ever justified.
 */
export async function runReconciliation(userId: string) {
  const admin = await requireAdmin()
  await enforce('admin.reconcile', admin.userId)

  const result = await reconcileSubscription(userId)

  await writeAudit({
    actorId: admin.userId,
    action: 'ADMIN_RECONCILE_RUN',
    entityType: 'Subscription',
    entityId: userId,
    // No provider ids, no amounts — only what the operation concluded.
    metadata: { reconciled: result.reconciled, reason: result.reason ?? null },
  })

  return result
}
