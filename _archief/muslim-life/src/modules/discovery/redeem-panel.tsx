'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Clock, Copy, Lock, Sparkles, TicketCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { issueRedemptionAction } from '@/modules/discovery/actions'
import type { RedemptionView } from '@/server/modules/discovery/redemption.service'

interface RedeemPanelProps {
  dealId: string
  canRedeem: boolean
  lockedReason: 'PREMIUM' | 'EXPIRED' | 'UPCOMING' | 'SOLD_OUT' | null
  /** Only ever populated when this member already holds a redemption. */
  existing: { code: string; status: string; issuedAt: Date; expiresAt: Date | null } | null
  isDemo: boolean
}

/**
 * Redemption.
 *
 * The code is not in the page until the member holds one. A locked deal renders
 * an explanation and nothing else — there is no hidden element for a free member
 * to reveal, because the server never generated a code in the first place.
 */
export function RedeemPanel({
  dealId,
  canRedeem,
  lockedReason,
  existing,
  isDemo,
}: RedeemPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [redemption, setRedemption] = useState<RedemptionView | null>(
    existing
      ? {
          id: '',
          dealId,
          code: existing.code,
          status: existing.status as RedemptionView['status'],
          issuedAt: existing.issuedAt,
          redeemedAt: null,
          expiresAt: existing.expiresAt,
          dealTitle: '',
          businessName: '',
        }
      : null,
  )
  const [copied, setCopied] = useState(false)

  function redeem() {
    startTransition(async () => {
      const result = await issueRedemptionAction({ dealId })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      setRedemption(result.data.redemption)
      toast.success(
        result.data.alreadyIssued ? 'You already have this code.' : 'Your code is ready.',
      )
      router.refresh()
    })
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the code and copy it manually.')
    }
  }

  // ── Already redeemed ──────────────────────────────────────────────────────
  if (redemption) {
    return (
      <Card variant="flat" className="border-primary/25 bg-primary-subtle p-5">
        <div className="flex items-center gap-2">
          <TicketCheck className="size-4 text-primary-subtle-foreground" aria-hidden />
          <p className="text-sm font-medium text-primary-subtle-foreground">Your code</p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-primary/25 bg-surface px-4 py-3 text-center font-mono text-lg font-semibold tracking-[0.12em]">
            {redemption.code}
          </code>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => copy(redemption.code)}
            aria-label="Copy code"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-primary-subtle-foreground/80">
          Show this code in store.{' '}
          {redemption.expiresAt
            ? `Valid until ${new Date(redemption.expiresAt).toISOString().slice(0, 10)}.`
            : null}
        </p>

        {isDemo ? (
          <p className="mt-3 rounded-lg bg-surface/70 px-3 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
            This is a demonstration offer. The code is real and saved to your account, but the
            business is not — it will not be honoured anywhere.
          </p>
        ) : null}
      </Card>
    )
  }

  // ── Locked ────────────────────────────────────────────────────────────────
  if (lockedReason === 'PREMIUM') {
    return (
      <Card variant="flat" className="border-accent/30 bg-accent-subtle p-5">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-accent-subtle-foreground" aria-hidden />
          <p className="text-sm font-medium text-accent-subtle-foreground">Premium deal</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-accent-subtle-foreground/80">
          Upgrade to use this offer. Member-only deals are part of Muslim Life Premium.
        </p>
        <Button size="sm" className="mt-4 w-full" asChild>
          <Link href="/pricing">
            <Sparkles />
            See Premium
          </Link>
        </Button>
      </Card>
    )
  }

  if (lockedReason === 'EXPIRED') {
    return (
      <Card variant="sunken" className="p-5">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">This deal has expired.</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          It can no longer be redeemed. Browse current offers instead.
        </p>
        <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
          <Link href="/app/explore/deals">See active deals</Link>
        </Button>
      </Card>
    )
  }

  if (lockedReason === 'UPCOMING') {
    return (
      <Card variant="sunken" className="p-5">
        <p className="text-sm font-medium">Not started yet</p>
        <p className="mt-2 text-xs text-muted-foreground">
          This offer is not available for redemption yet. Save it and come back.
        </p>
      </Card>
    )
  }

  if (lockedReason === 'SOLD_OUT') {
    return (
      <Card variant="sunken" className="p-5">
        <p className="text-sm font-medium">Fully claimed</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Every code for this offer has been issued.
        </p>
      </Card>
    )
  }

  // ── Redeemable ────────────────────────────────────────────────────────────
  return (
    <Card className="p-5">
      <p className="text-sm font-medium">Ready to use</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        We&apos;ll generate a code for you to show in store. One per member.
      </p>

      <Button className="mt-4 w-full" onClick={redeem} loading={pending} disabled={!canRedeem}>
        Get my code
      </Button>

      {isDemo ? (
        <Badge variant="default" size="sm" className="mt-3">
          Demonstration offer
        </Badge>
      ) : null}
    </Card>
  )
}
