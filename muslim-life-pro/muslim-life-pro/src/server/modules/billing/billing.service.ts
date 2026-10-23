import 'server-only'

import type { BillingInterval, Plan, SubscriptionStatus } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { appUrl } from '@/config/app-url'
import { PRICING } from '@/config/plans'
import { logger } from '@/lib/logger'
import {
  getPaymentProvider,
  getPaymentsStatus,
  isLivePayments,
} from '@/server/integrations/payments'
import { grantsAccess } from '@/server/modules/billing/access-policy'
import { resolvePrice } from '@/server/modules/billing/pricing'
import { BillingError, toBillingError } from '@/server/modules/billing/billing.errors'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { writeAudit } from '@/server/services/audit'

/**
 * Billing.
 *
 * Two rules that shape everything here:
 *
 *  1. **The webhook is the source of truth.** A redirect back from checkout
 *     proves the member's browser followed a link, nothing more. Subscription
 *     state changes only in `webhook.service.ts`.
 *  2. **Price is resolved server-side.** The browser names a plan and interval;
 *     it never supplies a price ID, or it could buy Premium at a €0 test price.
 */

/**
 * The access policy lives in `access-policy.ts` so actor resolution can share it
 * without importing this module. Re-exported here because this is where callers
 * look for it.
 */
export {
  grantsAccess,
  effectivePlan,
  PAST_DUE_GRACE_DAYS,
  STATUSES_GRANTING_ACCESS,
} from '@/server/modules/billing/access-policy'

export const checkoutInputSchema = z.object({
  plan: z.enum(['PREMIUM']),
  interval: z.enum(['MONTHLY', 'YEARLY']),
  /**
   * The member's express request that Premium starts immediately, with the
   * acknowledgement that withdrawing within 14 days means paying for the part
   * already provided (WER art. VI.47 §3 / Directive 2011/83/EU art. 14(3)).
   * Without it there is no checkout.
   */
  immediateStart: z.literal(true),
})

export type CheckoutInput = z.infer<typeof checkoutInputSchema>

export interface SubscriptionView {
  plan: Plan
  status: SubscriptionStatus
  interval: BillingInterval | null
  provider: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date | null
  /** Whether entitlements are currently active. */
  isActive: boolean
  /** True when they are in the post-cancellation runway. */
  isEnding: boolean
  /** True when a renewal failed and they are inside the grace window. */
  inGracePeriod: boolean
  hasProviderSubscription: boolean
  isDemoBilling: boolean
}

export async function getSubscription(actor: Actor): Promise<SubscriptionView> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: actor.userId },
    select: {
      plan: true,
      status: true,
      interval: true,
      provider: true,
      externalSubscriptionId: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      trialEndsAt: true,
    },
  })

  if (!subscription) {
    // Every member gets a FREE row at registration, so this is a data problem
    // rather than a normal state — but the read must not crash a page.
    logger.warn('billing.subscription.missing', { userId: actor.userId })
    return {
      plan: 'FREE',
      status: 'ACTIVE',
      interval: null,
      provider: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      isActive: false,
      isEnding: false,
      inGracePeriod: false,
      hasProviderSubscription: false,
      isDemoBilling: !isLivePayments(),
    }
  }

  const isActive = grantsAccess(subscription)

  return {
    plan: subscription.plan,
    status: subscription.status,
    interval: subscription.interval,
    provider: subscription.provider,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    isActive,
    isEnding: subscription.cancelAtPeriodEnd && isActive,
    inGracePeriod: subscription.status === 'PAST_DUE' && isActive,
    hasProviderSubscription: Boolean(subscription.externalSubscriptionId),
    isDemoBilling: subscription.provider === 'stub' || !isLivePayments(),
  }
}

export interface CheckoutResult {
  url: string
  sessionId: string
  isDemoBilling: boolean
}

/**
 * Start a checkout.
 *
 * Refuses when the member already has an active subscription — the correct move
 * there is the customer portal, not a second subscription they would be charged
 * for twice.
 */
export async function createCheckout(
  actor: Actor,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const data = checkoutInputSchema.parse(input)

  const status = getPaymentsStatus()
  if (!status.configured) {
    throw toBillingError(
      (() => {
        try {
          getPaymentProvider()
          return null
        } catch (error) {
          return error
        }
      })(),
      'PAYMENTS_NOT_CONFIGURED',
    )
  }

  const existing = await prisma.subscription.findUnique({
    where: { userId: actor.userId },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      externalCustomerId: true,
      externalSubscriptionId: true,
    },
  })

  if (existing && existing.externalSubscriptionId && grantsAccess(existing)) {
    throw new BillingError(
      'SUBSCRIPTION_ALREADY_ACTIVE',
      'You already have an active subscription. Use "Manage subscription" to change it.',
      409,
    )
  }

  const resolved = resolvePrice(data.plan, data.interval)
  if (!resolved.ok) {
    throw new BillingError(
      'UNKNOWN_PRICE',
      'That plan is not available for purchase right now.',
      400,
    )
  }

  const baseUrl = appUrl()

  try {
    const session = await getPaymentProvider().createCheckoutSession({
      userId: actor.userId,
      email: actor.email,
      plan: data.plan,
      interval: data.interval,
      priceId: resolved.price.priceId,
      externalCustomerId: existing?.externalCustomerId ?? null,
      // Trial on yearly plans, once per member: anyone who has ever had a
      // provider customer (i.e. started a paid checkout before) gets none.
      trialDays:
        data.interval === 'YEARLY' && !existing?.externalCustomerId && !existing?.externalSubscriptionId
          ? PRICING.trialDays
          : undefined,
      successUrl: `${baseUrl}/app/settings/billing/success`,
      cancelUrl: `${baseUrl}/app/settings/billing/cancel`,
    })

    await writeAudit({
      actorId: actor.userId,
      action: 'CHECKOUT_CREATED',
      entityType: 'Subscription',
      entityId: actor.userId,
      // No price, no customer id, no session secret — just what was chosen.
      metadata: { plan: data.plan, interval: data.interval },
    })

    await track(actor.userId, ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      isYearly: data.interval === 'YEARLY',
      isLiveBilling: isLivePayments(),
    })

    return { url: session.url, sessionId: session.id, isDemoBilling: !isLivePayments() }
  } catch (error) {
    logger.error('billing.checkout.failed', { error, userId: actor.userId })
    throw toBillingError(error, 'CHECKOUT_FAILED')
  }
}

/** Open the provider's customer portal. Upgrades, downgrades and cancellation all live there. */
export async function createPortalSession(actor: Actor): Promise<{ url: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: actor.userId },
    select: { externalCustomerId: true },
  })

  if (!subscription?.externalCustomerId) {
    throw new BillingError(
      'SUBSCRIPTION_NOT_FOUND',
      'There is no billing account to manage yet.',
      404,
    )
  }

  try {
    const session = await getPaymentProvider().createCustomerPortalSession({
      // Scoped to this member's own customer — never an id from the request.
      externalCustomerId: subscription.externalCustomerId,
      returnUrl: `${appUrl()}/app/settings/billing`,
    })

    await writeAudit({
      actorId: actor.userId,
      action: 'CUSTOMER_PORTAL_OPENED',
      entityType: 'Subscription',
      entityId: actor.userId,
      metadata: {},
    })

    return { url: session.url }
  } catch (error) {
    logger.error('billing.portal.failed', { error, userId: actor.userId })
    throw toBillingError(error, 'PORTAL_SESSION_FAILED')
  }
}
