import type { Metadata } from 'next'

import { CheckoutStatus } from '@/modules/billing/checkout-status'
import { requireActor } from '@/server/auth/actor'
import { getSubscription } from '@/server/modules/billing/billing.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

export const metadata: Metadata = {
  title: 'Subscription',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Post-checkout landing.
 *
 * Deliberately does NOT treat arriving here as proof of payment — it only reads
 * the current server-side state and hands off to a poller. The webhook remains
 * the only thing that can make someone Premium.
 */
export default async function CheckoutSuccessPage() {
  const actor = await requireActor()
  const subscription = await getSubscription(actor)

  if (subscription.isActive) {
    await track(actor.userId, ANALYTICS_EVENTS.CHECKOUT_COMPLETED, {
      isYearly: subscription.interval === 'YEARLY',
    })
  }

  return (
    <div className="mx-auto max-w-lg py-6">
      <CheckoutStatus initiallyActive={subscription.isActive} />
    </div>
  )
}
