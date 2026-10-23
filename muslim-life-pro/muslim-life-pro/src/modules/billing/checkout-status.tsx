'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Post-checkout status.
 *
 * The redirect proves the member's browser followed a link — nothing more. The
 * subscription is only real once the webhook has been processed, so this polls
 * our own API until the server says so, rather than showing "You're Premium!"
 * on the strength of a URL anyone could visit.
 */

const POLL_INTERVAL_MS = 1500
const MAX_ATTEMPTS = 20

interface SubscriptionPayload {
  plan: string
  isActive: boolean
  isDemoBilling: boolean
}

export function CheckoutStatus({ initiallyActive }: { initiallyActive: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<'pending' | 'active' | 'slow'>(
    initiallyActive ? 'active' : 'pending',
  )
  const [isDemo, setIsDemo] = useState(false)
  const attempts = useRef(0)

  useEffect(() => {
    if (state === 'active') return

    let cancelled = false

    async function poll() {
      attempts.current += 1

      try {
        const response = await fetch('/api/billing/subscription', { cache: 'no-store' })
        if (response.ok) {
          const payload = (await response.json()) as { subscription: SubscriptionPayload }

          if (!cancelled && payload.subscription.isActive) {
            setIsDemo(payload.subscription.isDemoBilling)
            setState('active')
            // Refresh so the shell, nav and every gated feature pick up the
            // new entitlement immediately.
            router.refresh()
            return
          }
        }
      } catch {
        // Network blip — keep polling until the attempt budget runs out.
      }

      if (cancelled) return

      if (attempts.current >= MAX_ATTEMPTS) {
        setState('slow')
        return
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    let timer = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [state, router])

  if (state === 'active') {
    return (
      <Card className="px-5 py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-subtle">
          <CheckCircle2 className="size-6 text-primary-subtle-foreground" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">
          You&apos;re on Premium
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Everything is unlocked — unlimited habits and saved places, the plan generators,
          more assistant messages and member-only deals.
        </p>

        {isDemo ? (
          <p className="mx-auto mt-4 max-w-sm rounded-lg bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
            This was a demo checkout. No payment was taken.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/app">Go to My Day</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/app/settings/billing">Billing settings</Link>
          </Button>
        </div>
      </Card>
    )
  }

  if (state === 'slow') {
    return (
      <Card className="px-5 py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Clock className="size-6 text-muted-foreground" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-xl font-semibold tracking-[-0.02em]">
          This is taking longer than usual
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your payment may well have gone through — we are waiting for confirmation from the
          payment provider. Nothing is lost; this page will catch up, and so will your account.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Check again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/app/settings/billing">Billing settings</Link>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="px-5 py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </span>

      <h1 className="mt-5 font-display text-xl font-semibold tracking-[-0.02em]">
        Setting up your subscription
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        We&apos;re confirming this with the payment provider. It usually takes a few seconds.
      </p>
    </Card>
  )
}
