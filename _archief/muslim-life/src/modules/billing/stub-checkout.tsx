'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PRICING } from '@/config/plans'

/**
 * Stands in for the provider-hosted checkout page.
 *
 * Every outcome a real provider can produce is reachable here — success, trial,
 * failure, abandonment — so the whole flow can be exercised locally without
 * credentials. It is unmistakably a demo, and the route that backs it does not
 * exist outside development.
 */

type Scenario =
  | 'SUBSCRIPTION_ACTIVE'
  | 'SUBSCRIPTION_TRIALING'
  | 'PAYMENT_FAILED'

const SCENARIOS: { value: Scenario; label: string; description: string }[] = [
  {
    value: 'SUBSCRIPTION_ACTIVE',
    label: 'Payment succeeds',
    description: 'Subscription becomes active and entitlements unlock.',
  },
  {
    value: 'SUBSCRIPTION_TRIALING',
    label: 'Starts a trial',
    description: 'Subscription is trialing. Access is granted during the trial.',
  },
  {
    value: 'PAYMENT_FAILED',
    label: 'Payment fails',
    description: 'Subscription is past due. Access continues during the grace window.',
  },
]

export function StubCheckout({
  interval,
  plan,
}: {
  interval: 'MONTHLY' | 'YEARLY'
  plan: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<Scenario>('SUBSCRIPTION_ACTIVE')

  const price = interval === 'YEARLY' ? PRICING.yearly : PRICING.monthly

  function simulate() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/webhooks/stub', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenario: chosen, interval }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          toast.error(payload?.error?.message ?? 'Simulation failed.')
          return
        }

        router.push('/app/settings/billing/success')
        router.refresh()
      } catch {
        toast.error('Could not reach the stub provider.')
      }
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border bg-surface-sunken px-5 py-3">
        <FlaskConical className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium text-muted-foreground">
          Demo checkout — no payment provider is connected and nothing is charged
        </p>
      </div>

      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Muslim Life {plan.toLowerCase()}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em]">
          {PRICING.symbol}
          {price.display}
          <span className="ms-1.5 text-sm font-normal text-muted-foreground">
            {interval === 'YEARLY' ? '/year' : '/month'} {PRICING.currency}
          </span>
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">What should happen?</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            A real provider decides this. Here you choose, so every outcome is testable.
          </p>

          <div className="mt-3 space-y-2">
            {SCENARIOS.map((scenario) => (
              <label
                key={scenario.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                  chosen === scenario.value
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  value={scenario.value}
                  checked={chosen === scenario.value}
                  onChange={() => setChosen(scenario.value)}
                  className="mt-0.5 size-4 accent-current"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{scenario.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {scenario.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Button onClick={simulate} loading={pending} className="sm:flex-1">
            Complete demo checkout
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/app/settings/billing/cancel">Cancel</Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
