import type { Metadata } from 'next'
import Link from 'next/link'
import { XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Checkout cancelled',
  robots: { index: false, follow: false },
}

/**
 * Checkout was abandoned.
 *
 * Nothing is mutated here — a cancelled checkout is simply a checkout that did
 * not happen, and treating the redirect as a signal to change state would be the
 * same mistake as trusting the success redirect.
 */
export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-lg py-6">
      <Card className="px-5 py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
          <XCircle className="size-6 text-muted-foreground" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-xl font-semibold tracking-[-0.02em]">
          No changes made
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          You closed the checkout before finishing, so nothing was charged and your plan is
          unchanged. You can pick it up again whenever you like.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/app">Back to My Day</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
