'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * Starts a checkout, or opens the customer portal.
 *
 * The button sends only a plan and an interval. The price is resolved on the
 * server, so nothing here can influence what is charged.
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

  function start() {
    setBusy(true)

    startTransition(async () => {
      try {
        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan, interval }),
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
    <Button {...buttonProps} onClick={start} loading={pending || busy}>
      {label}
    </Button>
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
