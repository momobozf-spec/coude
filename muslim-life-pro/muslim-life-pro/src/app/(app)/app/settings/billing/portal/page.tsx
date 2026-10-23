import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FlaskConical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StubPortal } from '@/modules/billing/stub-portal'
import { requireActor } from '@/server/auth/actor'
import { getPaymentsStatus } from '@/server/integrations/payments'
import { getSubscription } from '@/server/modules/billing/billing.service'

export const metadata: Metadata = {
  title: 'Manage subscription',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Stub customer portal.
 *
 * Mirrors what a provider portal offers: change interval, cancel at period end,
 * cancel immediately, resume. Only reachable in stub mode.
 */
export default async function StubPortalPage() {
  const actor = await requireActor()

  const status = getPaymentsStatus()
  if (!status.configured || !status.isStub) notFound()

  const subscription = await getSubscription(actor)

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken px-4 py-3">
        <FlaskConical className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Demo portal.</span> With a real provider
          this is their hosted page. Every action here goes through the same webhook path.
        </p>
      </div>

      <Card className="p-5">
        <StubPortal
          interval={subscription.interval ?? 'MONTHLY'}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          isActive={subscription.isActive}
        />
      </Card>

      <Button variant="ghost" className="w-full" asChild>
        <Link href="/app/settings/billing">Back to billing</Link>
      </Button>
    </div>
  )
}
