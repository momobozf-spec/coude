import type { Metadata } from 'next'

import { PricingTable } from '@/modules/subscription/pricing-table'
import { getActor } from '@/server/auth/actor'
import { getSubscription } from '@/server/modules/billing/billing.service'
import { getPublicPricing } from '@/server/modules/billing/pricing'
import { getPaymentsStatus } from '@/server/integrations/payments'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Muslim Life Free includes prayer times, tracking and a daily planner. Premium adds unlimited habits and saved places, more assistant messages, the plan generators and member-only deals.',
}

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const actor = await getActor()

  // Prices come from the same server config the checkout resolves against, so
  // what is shown and what is charged cannot drift.
  const pricing = getPublicPricing()
  const payments = getPaymentsStatus()

  const subscription = actor ? await getSubscription(actor) : null

  if (actor) {
    await track(actor.userId, ANALYTICS_EVENTS.PRICING_OPENED, {
      isSubscriber: subscription?.isActive ?? false,
    })
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-50"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 0%, var(--primary-subtle) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            {t('pricing.title')}
          </h1>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            {t('pricing.subtitle')}
          </p>
        </div>

        <PricingTable
          currentPlan={actor?.plan ?? null}
          signedIn={Boolean(actor)}
          isSubscribed={subscription?.isActive ?? false}
          canManage={subscription?.hasProviderSubscription ?? false}
          availableIntervals={pricing
            .filter((price) => price.available)
            .map((price) => price.interval)}
          paymentsConfigured={payments.configured}
          isDemoBilling={payments.configured && payments.isStub}
        />
      </div>
    </div>
  )
}
