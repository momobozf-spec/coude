'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { t } from '@/i18n'

/**
 * Starts a checkout, or opens the customer portal.
 *
 * The button sends only a plan, an interval and the member's express request
 * to start immediately. The price is resolved on the server, so nothing here
 * can influence what is charged.
 *
 * EU consumer law: a subscription that starts during the 14-day withdrawal
 * period needs the consumer's express request and acknowledgement that a
 * withdrawal then costs the part already provided. The checkbox must be ticked
 * before checkout starts; the server refuses the request without it.
 */
export function CheckoutButton({
  plan = 'PREMIUM',
  interval,
  label,
  ...buttonProps
}: {
  plan?: 'PREMIUM'
  interval: 'MONTHLY' | 'YEARLY'
  label: string
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [consented, setConsented] = useState(false)
  const consentId = useId()

  function start() {
    if (!consented) {
      toast.error(t('pricing.immediateStartRequired'))
      return
    }
    setBusy(true)

    startTransition(async () => {
      try {
        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan, interval, immediateStart: true }),
        })

        const payload = await response.json()

        if (!response.ok) {
          toast.error(payload?.error?.message ?? 'Could not start checkout.')
          setBusy(false)
          return
        }

        // Stub returns an internal route; Stripe returns a hosted URL. The
        // button does not care which.
        if (payload.url.startsWith('/')) router.push(payload.url)
        else window.location.assign(payload.url)
      } catch {
        toast.error('Could not reach billing. Please try again.')
        setBusy(false)
      }
    })
  }

  return (
    <div className="space-y-2">
      <label htmlFor={consentId} className="flex cursor-pointer items-start gap-2 text-start text-xs leading-snug text-muted-foreground">
        <input
          id={consentId}
          type="checkbox"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
        />
        <span>{t('pricing.immediateStartConsent')}</span>
      </label>
      <Button {...buttonProps} onClick={start} loading={pending || busy} disabled={!consented}>
        {label}
      </Button>
    </div>
  )
}

export function ManageSubscriptionButton({
  label = 'Manage subscription',
  ...buttonProps
}: { label?: string } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function open() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/billing/portal', { method: 'POST' })
        const payload = await response.json()

        if (!response.ok) {
          toast.error(payload?.error?.message ?? 'Could not open billing management.')
          return
        }

        if (payload.url.startsWith('/')) router.push(payload.url)
        else window.location.assign(payload.url)
      } catch {
        toast.error('Could not reach billing. Please try again.')
      }
    })
  }

  return (
    <Button {...buttonProps} onClick={open} loading={pending}>
      {label}
    </Button>
  )
}
