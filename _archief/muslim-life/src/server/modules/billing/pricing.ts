import 'server-only'

import type { BillingInterval, Plan } from '@prisma/client'

import { serverEnv } from '@/config/env'
import { PRICING } from '@/config/plans'

/**
 * Price mapping.
 *
 * The single server-side translation between a commercial price and an internal
 * plan. Nothing else in the codebase may branch on a price ID, and the browser
 * never supplies one — it names a plan and an interval, and this resolves the
 * rest.
 *
 * An unrecognised price resolves to `UNKNOWN_PRICE` and grants nothing. Failing
 * open here would mean any price on the Stripe account — including a €0 test
 * price someone created — silently conferring Premium.
 */

export interface PriceDescriptor {
  plan: Plan
  interval: BillingInterval
  priceId: string
  /** Minor units, from `plans.ts` — the display price we are willing to state. */
  amount: number
  currency: string
}

export type PriceResolution =
  | { ok: true; price: PriceDescriptor }
  | { ok: false; reason: 'UNKNOWN_PRICE' }

/** Every sellable price, built from config. Stub mode uses synthetic ids. */
export function listPrices(): PriceDescriptor[] {
  const env = serverEnv()
  const stub = env.PAYMENTS_PROVIDER !== 'stripe'

  const monthlyId = stub
    ? 'price_stub_premium_monthly'
    : (env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '')
  const yearlyId = stub ? 'price_stub_premium_yearly' : (env.STRIPE_PRICE_PREMIUM_YEARLY ?? '')

  const prices: PriceDescriptor[] = []

  if (monthlyId) {
    prices.push({
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: monthlyId,
      amount: PRICING.monthly.amount,
      currency: PRICING.currency,
    })
  }

  if (yearlyId) {
    prices.push({
      plan: 'PREMIUM',
      interval: 'YEARLY',
      priceId: yearlyId,
      amount: PRICING.yearly.amount,
      currency: PRICING.currency,
    })
  }

  return prices
}

/** Resolve a plan + interval to a price. Used by checkout. */
export function resolvePrice(plan: Plan, interval: BillingInterval): PriceResolution {
  const price = listPrices().find(
    (candidate) => candidate.plan === plan && candidate.interval === interval,
  )

  return price ? { ok: true, price } : { ok: false, reason: 'UNKNOWN_PRICE' }
}

/**
 * Resolve a provider price back to an internal plan. Used by webhooks.
 *
 * Fails closed: an unknown price never yields a plan.
 */
export function resolvePriceId(priceId: string | null | undefined): PriceResolution {
  if (!priceId) return { ok: false, reason: 'UNKNOWN_PRICE' }

  const price = listPrices().find((candidate) => candidate.priceId === priceId)
  return price ? { ok: true, price } : { ok: false, reason: 'UNKNOWN_PRICE' }
}

/**
 * Public presentation, derived from the same config the checkout uses.
 *
 * Prices shown to a member and prices charged therefore cannot drift — the
 * classic billing bug where a pricing page says €7.99 and Stripe charges €9.99.
 */
export interface PublicPrice {
  plan: Plan
  interval: BillingInterval
  amount: number
  currency: string
  display: string
  available: boolean
}

export function getPublicPricing(): PublicPrice[] {
  const prices = listPrices()

  return (['MONTHLY', 'YEARLY'] as const).map((interval) => {
    const price = prices.find((candidate) => candidate.interval === interval)
    const source = interval === 'MONTHLY' ? PRICING.monthly : PRICING.yearly

    return {
      plan: 'PREMIUM' as Plan,
      interval,
      amount: source.amount,
      currency: PRICING.currency,
      display: source.display,
      // False when the interval has no configured price — the UI then disables
      // it rather than offering a checkout that would fail.
      available: Boolean(price),
    }
  })
}
