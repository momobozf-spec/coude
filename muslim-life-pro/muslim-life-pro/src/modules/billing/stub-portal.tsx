'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Stub customer portal controls.
 *
 * Each action fires the corresponding webhook scenario, so the state change
 * travels the same path a real provider's would — nothing here writes to the
 * subscription directly.
 */
export function StubPortal({
  interval,
  cancelAtPeriodEnd,
  isActive,
}: {
  interval: 'MONTHLY' | 'YEARLY'
  cancelAtPeriodEnd: boolean
  isActive: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function simulate(
    scenario:
      | 'SUBSCRIPTION_ACTIVE'
      | 'SUBSCRIPTION_CANCEL_AT_PERIOD_END'
      | 'SUBSCRIPTION_CANCELLED'
      | 'PAYMENT_SUCCEEDED',
    nextInterval: 'MONTHLY' | 'YEARLY' = interval,
    successMessage = 'Updated.',
  ) {
    startTransition(async () => {
      try {
        const response = await fetch('/api/webhooks/stub', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenario, interval: nextInterval }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          toast.error(payload?.error?.message ?? 'Could not update the subscription.')
          return
        }

        toast.success(successMessage)
        router.refresh()
      } catch {
        toast.error('Could not reach the stub provider.')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Billing interval</h2>
          <Badge variant="outline" size="sm">
            {interval === 'YEARLY' ? 'Yearly' : 'Monthly'}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant={interval === 'MONTHLY' ? 'secondary' : 'outline'}
            size="sm"
            disabled={pending || interval === 'MONTHLY'}
            onClick={() =>
              simulate('SUBSCRIPTION_ACTIVE', 'MONTHLY', 'Switched to monthly billing.')
            }
          >
            Switch to monthly
          </Button>
          <Button
            variant={interval === 'YEARLY' ? 'secondary' : 'outline'}
            size="sm"
            disabled={pending || interval === 'YEARLY'}
            onClick={() =>
              simulate('SUBSCRIPTION_ACTIVE', 'YEARLY', 'Switched to yearly billing.')
            }
          >
            Switch to yearly
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h2 className="text-sm font-medium">Subscription</h2>

        {cancelAtPeriodEnd ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Set to end at the end of the current period. You keep every feature until then.
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={pending}
              onClick={() => simulate('SUBSCRIPTION_ACTIVE', interval, 'Subscription resumed.')}
            >
              Resume subscription
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Cancelling keeps your access until the end of the period you have paid for.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                size="sm"
                disabled={pending || !isActive}
                onClick={() =>
                  simulate(
                    'SUBSCRIPTION_CANCEL_AT_PERIOD_END',
                    interval,
                    'Will end at the end of the period.',
                  )
                }
              >
                Cancel at period end
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  simulate('SUBSCRIPTION_CANCELLED', interval, 'Subscription cancelled.')
                }
                className="text-danger"
              >
                Cancel immediately
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
