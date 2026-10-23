import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StubCheckout } from '@/modules/billing/stub-checkout'
import { requireActor } from '@/server/auth/actor'
import { getPaymentsStatus } from '@/server/integrations/payments'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Stub checkout page.
 *
 * Only reachable in stub mode — with Stripe configured, `createCheckoutSession`
 * returns a hosted URL and this route is never linked. It 404s otherwise so it
 * cannot be found by guessing.
 */
export default async function StubCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireActor()

  const status = getPaymentsStatus()
  if (!status.configured || !status.isStub) notFound()

  const params = await searchParams
  const interval = params.interval === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
  const plan = typeof params.plan === 'string' ? params.plan : 'PREMIUM'

  return (
    <div className="mx-auto max-w-lg py-6">
      <StubCheckout interval={interval} plan={plan} />
    </div>
  )
}
