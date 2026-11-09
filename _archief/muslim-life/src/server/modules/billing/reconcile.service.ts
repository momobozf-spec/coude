import 'server-only'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import { getPaymentProvider } from '@/server/integrations/payments'
import { BillingError, toBillingError } from '@/server/modules/billing/billing.errors'
import { syncSubscription } from '@/server/modules/billing/webhook.service'
import { writeAudit } from '@/server/services/audit'

/**
 * Reconciliation.
 *
 * Re-reads state from the provider and writes it back. Webhooks are the normal
 * path; this is the repair tool for when a delivery was lost, an endpoint was
 * misconfigured for a while, or someone needs an answer to "why is this member
 * still on Free after paying".
 *
 * Deliberately manual and admin-only. A cron job that silently rewrites billing
 * state hides exactly the failures worth noticing.
 */
export async function reconcileSubscription(userId: string): Promise<{
  reconciled: boolean
  reason?: string
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { id: true, externalSubscriptionId: true, provider: true },
  })

  if (!subscription) {
    throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'No subscription for that member.', 404)
  }

  if (!subscription.externalSubscriptionId) {
    return { reconciled: false, reason: 'No provider subscription to reconcile.' }
  }

  try {
    const provider = getPaymentProvider()
    const external = await provider.getSubscription(subscription.externalSubscriptionId)

    // Reconciliation is authoritative by definition — clear the ordering guard
    // so provider state always wins here, unlike a webhook.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { providerUpdatedAt: null },
    })

    const result = await syncSubscription(external, provider.id, userId)

    await writeAudit({
      actorId: userId,
      action: 'SUBSCRIPTION_RECONCILED',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { processed: result.processed, reason: result.reason ?? null },
    })

    return { reconciled: result.processed, reason: result.reason }
  } catch (error) {
    logger.error('billing.reconcile.failed', { userId, error })
    throw toBillingError(error, 'SUBSCRIPTION_NOT_FOUND')
  }
}

/** Members whose state looks stale, for an admin to review. */
export async function listReconciliationCandidates(limit = 25) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  return prisma.subscription.findMany({
    where: {
      externalSubscriptionId: { not: null },
      OR: [
        { status: 'PAST_DUE' },
        { status: 'INCOMPLETE' },
        // Period ended but nothing arrived to renew or cancel it.
        { currentPeriodEnd: { lt: cutoff }, plan: 'PREMIUM' },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      userId: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      providerUpdatedAt: true,
      user: { select: { email: true } },
    },
  })
}
