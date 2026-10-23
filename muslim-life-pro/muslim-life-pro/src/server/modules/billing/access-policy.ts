import type { Plan, SubscriptionStatus } from '@prisma/client'

/**
 * Does a subscription currently grant entitlements?
 *
 * The one place that question is answered. `entitlements.ts` decides what a plan
 * unlocks; this decides whether the plan counts at all.
 *
 * It lives in its own module — with no imports beyond Prisma's generated types —
 * because both the billing service and actor resolution need it, and the two
 * must never drift. They did drift once: `getActor` read the raw status and cut
 * a member off the moment a renewal failed, while the billing page still showed
 * them inside the grace window. Same function now, so that cannot recur.
 */

export const STATUSES_GRANTING_ACCESS: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

/**
 * Past-due handling.
 *
 * A failed renewal is usually an expired card, not a decision to leave. Cutting
 * someone off the moment a charge fails punishes the wrong thing, so PAST_DUE
 * keeps access for a grace window while the provider retries.
 */
export const PAST_DUE_GRACE_DAYS = 7

export function grantsAccess(
  subscription: {
    plan: Plan
    status: SubscriptionStatus
    currentPeriodEnd: Date | null
  },
  now: Date = new Date(),
): boolean {
  if (subscription.plan === 'FREE') return false

  if (STATUSES_GRANTING_ACCESS.includes(subscription.status)) return true

  // Grace: keep access while the provider retries the charge.
  if (subscription.status === 'PAST_DUE' && subscription.currentPeriodEnd) {
    const graceEnds = new Date(subscription.currentPeriodEnd)
    graceEnds.setUTCDate(graceEnds.getUTCDate() + PAST_DUE_GRACE_DAYS)
    return now <= graceEnds
  }

  return false
}

/**
 * The plan to act on, given the stored subscription.
 *
 * `null` (no subscription row) and a lapsed subscription are the same answer:
 * FREE. Callers should never re-derive this from `subscription.plan` alone.
 */
export function effectivePlan(
  subscription: {
    plan: Plan
    status: SubscriptionStatus
    currentPeriodEnd: Date | null
  } | null,
  now: Date = new Date(),
): Plan {
  if (!subscription) return 'FREE'
  return grantsAccess(subscription, now) ? subscription.plan : 'FREE'
}
