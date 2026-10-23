import 'server-only'

import { Prisma, type SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import {
  getPaymentProvider,
  getPaymentsStatus,
  type ExternalSubscription,
  type ExternalSubscriptionStatus,
  type PaymentWebhookEvent,
} from '@/server/integrations/payments'
import { resolvePriceId } from '@/server/modules/billing/pricing'
import { BillingError, toBillingError } from '@/server/modules/billing/billing.errors'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { writeAudit } from '@/server/services/audit'
import { PAST_DUE_GRACE_DAYS } from '@/server/modules/billing/access-policy'
import { dispatchNotification } from '@/server/modules/notifications/notification.service'

/**
 * Webhook processing — the source of truth for subscription state.
 *
 * Three properties this must hold:
 *
 *  1. **Exactly-once.** The unique constraint on (provider, externalEventId) is
 *     what enforces it, not a read-then-check that two concurrent deliveries
 *     would both pass.
 *  2. **Order-independent.** Providers do not guarantee ordering. An event older
 *     than the state we already hold is recorded and ignored, so a late
 *     "cancelled" cannot undo a newer "active".
 *  3. **Fail closed.** An unrecognised price grants nothing.
 */

/** Provider status → internal status. Anything unmapped is treated as no access. */
const STATUS_MAP: Record<ExternalSubscriptionStatus, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  unpaid: 'PAST_DUE',
  paused: 'CANCELED',
}

export interface WebhookResult {
  /** False when the event had already been processed. */
  processed: boolean
  reason?: 'DUPLICATE' | 'STALE' | 'UNSUPPORTED' | 'UNKNOWN_PRICE' | 'NO_MEMBER'
  eventId?: string
}

/**
 * Verify, record and apply a webhook.
 *
 * @param rawPayload The unparsed body. Any re-serialisation breaks the signature.
 */
export async function handleWebhook(
  rawPayload: string,
  signature: string | null,
): Promise<WebhookResult> {
  const status = getPaymentsStatus()
  if (!status.configured) {
    throw new BillingError('PAYMENTS_NOT_CONFIGURED', 'Payments are not configured.', 503)
  }

  const provider = getPaymentProvider()

  let event: PaymentWebhookEvent
  try {
    event = await provider.parseWebhook(rawPayload, signature)
  } catch (error) {
    await writeAudit({
      action: 'WEBHOOK_REJECTED',
      entityType: 'WebhookEvent',
      metadata: { provider: provider.id },
    })
    throw toBillingError(error, 'WEBHOOK_SIGNATURE_INVALID')
  }

  // Claim the event. A duplicate delivery collides here.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: provider.id,
        externalEventId: event.externalEventId,
        type: event.type,
        eventCreatedAt: event.eventCreatedAt,
        // Stored for support and replay. It contains no card data — providers
        // do not put PANs in webhooks.
        payload: JSON.parse(rawPayload) as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error
    }

    // Seen before. A provider REDELIVERS an event we answered with 5xx, so a
    // previous failed attempt must be retried here — otherwise one transient
    // database error would leave the member's subscription out of sync for good.
    // Re-claim atomically, and only when the earlier attempt failed (or stalled
    // for over five minutes), so two concurrent deliveries never both apply it.
    const reclaimed = await prisma.webhookEvent.updateMany({
      where: {
        provider: provider.id,
        externalEventId: event.externalEventId,
        processedAt: null,
        OR: [
          { error: { not: null } },
          { createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
      data: { error: null },
    })

    if (reclaimed.count !== 1) {
      // Processed already, or another delivery is applying it right now.
      // Returning 2xx stops the provider retrying forever.
      logger.info('billing.webhook.duplicate', { eventId: event.externalEventId })
      return { processed: false, reason: 'DUPLICATE', eventId: event.externalEventId }
    }

    logger.info('billing.webhook.retry', { eventId: event.externalEventId })
  }

  try {
    const result = await applyEvent(event, provider.id)

    await prisma.webhookEvent.update({
      where: {
        provider_externalEventId: {
          provider: provider.id,
          externalEventId: event.externalEventId,
        },
      },
      data: { processedAt: new Date() },
    })

    return { ...result, eventId: event.externalEventId }
  } catch (error) {
    // Record the failure and rethrow, so the route returns non-2xx and the
    // provider retries. The event row stays unprocessed.
    await prisma.webhookEvent
      .update({
        where: {
          provider_externalEventId: {
            provider: provider.id,
            externalEventId: event.externalEventId,
          },
        },
        data: { error: error instanceof Error ? error.message.slice(0, 500) : 'unknown' },
      })
      .catch(() => undefined)

    logger.error('billing.webhook.failed', { eventId: event.externalEventId, error })
    throw error
  }
}

async function applyEvent(
  event: PaymentWebhookEvent,
  providerId: string,
): Promise<WebhookResult> {
  switch (event.type) {
    case 'SUBSCRIPTION_CHANGED':
      return syncSubscription(event.subscription, providerId, event.userId ?? null)

    case 'SUBSCRIPTION_DELETED':
      return syncSubscription(
        { ...event.subscription, status: 'canceled', cancelAtPeriodEnd: false },
        providerId,
        null,
      )

    case 'PAYMENT_FAILED': {
      const updated = await prisma.subscription.updateMany({
        where: { externalCustomerId: event.externalCustomerId, plan: 'PREMIUM' },
        data: { status: 'PAST_DUE', providerUpdatedAt: event.eventCreatedAt },
      })

      if (updated.count === 0) return { processed: false, reason: 'NO_MEMBER' }
      return { processed: true }
    }

    case 'PAYMENT_SUCCEEDED': {
      // A successful invoice after a failure clears the past-due flag. The
      // subscription event that follows carries the authoritative period, so
      // nothing else is touched here.
      await prisma.subscription.updateMany({
        where: { externalCustomerId: event.externalCustomerId, status: 'PAST_DUE' },
        data: { status: 'ACTIVE', providerUpdatedAt: event.eventCreatedAt },
      })
      return { processed: true }
    }

    default:
      return { processed: false, reason: 'UNSUPPORTED' }
  }
}

/**
 * Write provider state onto the member's subscription.
 *
 * Finds the member by external subscription id, then customer id, then the
 * userId carried on the event — in that order, because the first two are stable
 * and the third only exists on checkout completion.
 */
export async function syncSubscription(
  external: ExternalSubscription,
  providerId: string,
  userIdHint: string | null,
): Promise<WebhookResult> {
  const priceResolution = resolvePriceId(external.externalPriceId)

  // Fail closed. An unknown price must never confer a plan — otherwise any price
  // on the provider account, including a €0 test price, becomes a free upgrade.
  if (!priceResolution.ok && external.status !== 'canceled') {
    logger.warn('billing.webhook.unknown_price', {
      priceId: external.externalPriceId,
      subscriptionId: external.externalSubscriptionId,
    })
    return { processed: false, reason: 'UNKNOWN_PRICE' }
  }

  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [
        { externalSubscriptionId: external.externalSubscriptionId },
        { externalCustomerId: external.externalCustomerId },
        ...(userIdHint ? [{ userId: userIdHint }] : []),
      ],
    },
    select: { id: true, userId: true, plan: true, status: true, providerUpdatedAt: true },
  })

  if (!existing) {
    logger.warn('billing.webhook.no_member', {
      subscriptionId: external.externalSubscriptionId,
    })
    return { processed: false, reason: 'NO_MEMBER' }
  }

  // Out-of-order guard. Providers retry and reorder; a stale event must not
  // overwrite newer state.
  if (
    existing.providerUpdatedAt &&
    external.providerUpdatedAt < existing.providerUpdatedAt
  ) {
    logger.info('billing.webhook.stale', {
      subscriptionId: external.externalSubscriptionId,
      eventAt: external.providerUpdatedAt.toISOString(),
      currentAt: existing.providerUpdatedAt.toISOString(),
    })
    return { processed: false, reason: 'STALE' }
  }

  const status = STATUS_MAP[external.status] ?? 'INCOMPLETE'
  const cancelled = status === 'CANCELED'

  const plan = cancelled ? 'FREE' : (priceResolution.ok ? priceResolution.price.plan : 'FREE')
  const interval =
    cancelled || !priceResolution.ok ? null : priceResolution.price.interval

  const wasActive = existing.plan === 'PREMIUM' && existing.status !== 'CANCELED'

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      plan,
      status,
      interval,
      provider: providerId,
      externalCustomerId: external.externalCustomerId,
      externalSubscriptionId: external.externalSubscriptionId,
      externalPriceId: external.externalPriceId,
      currentPeriodStart: external.currentPeriodStart,
      currentPeriodEnd: external.currentPeriodEnd,
      cancelAtPeriodEnd: external.cancelAtPeriodEnd,
      trialEndsAt: external.trialEndsAt,
      providerUpdatedAt: external.providerUpdatedAt,
    },
  })

  await writeAudit({
    actorId: existing.userId,
    action: cancelled
      ? 'SUBSCRIPTION_CANCELLED'
      : wasActive
        ? 'SUBSCRIPTION_UPDATED'
        : 'SUBSCRIPTION_CREATED',
    entityType: 'Subscription',
    entityId: existing.id,
    metadata: { plan, status, cancelAtPeriodEnd: external.cancelAtPeriodEnd },
  })

  if (!wasActive && plan === 'PREMIUM') {
    await track(existing.userId, ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED, {
      isYearly: interval === 'YEARLY',
      isTrial: status === 'TRIALING',
    })
  }

  if (external.cancelAtPeriodEnd && !cancelled) {
    await track(existing.userId, ANALYTICS_EVENTS.SUBSCRIPTION_CANCEL_REQUESTED, {})
  }

  /*
   * Tell the member when their money is involved.
   *
   * Only on a transition — `status !== existing.status` — because a provider
   * will happily resend the same `past_due` subscription several times while it
   * retries the charge, and three identical "your payment failed" notices is
   * how a helpful message becomes harassment. The idempotency key carries the
   * period end as its occurrence, so a genuine second failure next month is a
   * new notification while a retry of this one is not.
   *
   * Dispatch never throws into the webhook path: the webhook's job is to record
   * provider state correctly, and a notification problem must not make us
   * return a non-2xx that causes the provider to redeliver a billing event.
   */
  if (status !== existing.status) {
    const occurrence = external.currentPeriodEnd?.toISOString().slice(0, 10) ?? 'current'

    if (status === 'PAST_DUE') {
      await dispatchNotification({
        userId: existing.userId,
        type: 'BILLING_PAYMENT_FAILED',
        resourceId: existing.id,
        occurrence,
        variables: { graceDays: PAST_DUE_GRACE_DAYS },
        url: '/app/settings/billing',
      }).catch((error) => logger.warn('billing.notify.failed', { error: String(error) }))
    }

    if (cancelled && wasActive) {
      await dispatchNotification({
        userId: existing.userId,
        type: 'BILLING_SUBSCRIPTION_ENDED',
        resourceId: existing.id,
        occurrence,
        url: '/app/settings/billing',
      }).catch((error) => logger.warn('billing.notify.failed', { error: String(error) }))
    }
  }

  return { processed: true }
}
