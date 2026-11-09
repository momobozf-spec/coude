import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * The upgrade state a blocked action turns into.
 *
 * A member never sees "402 Payment Required" — the server throws an
 * `EntitlementError`, and this is what that becomes. One clear call to action
 * per blocked action; no stacking of prompts.
 */

export interface UpgradePromptProps {
  title: string
  body: string
  /** Shown when a cap was reached rather than a feature being wholly absent. */
  usage?: string
  variant?: 'card' | 'inline'
  className?: string
}

export function UpgradePrompt({
  title,
  body,
  usage,
  variant = 'card',
  className,
}: UpgradePromptProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3',
          className,
        )}
      >
        <p className="text-xs leading-relaxed text-accent-subtle-foreground">
          <span className="font-medium">{title}</span> {body}
        </p>
        <Button size="sm" asChild>
          <Link href="/pricing">Upgrade</Link>
        </Button>
      </div>
    )
  }

  return (
    <Card variant="flat" className={cn('border-accent/30 bg-accent-subtle p-5', className)}>
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-accent-subtle-foreground" aria-hidden />
        <p className="text-sm font-medium text-accent-subtle-foreground">{title}</p>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-accent-subtle-foreground/80">{body}</p>

      {usage ? (
        <p className="mt-2 text-[0.6875rem] text-accent-subtle-foreground/70">{usage}</p>
      ) : null}

      <Button size="sm" className="mt-4" asChild>
        <Link href="/pricing">
          <Sparkles />
          See Premium
        </Link>
      </Button>
    </Card>
  )
}

/**
 * Copy for each gate, keyed by entitlement.
 *
 * Central so the same limit is described the same way everywhere, and so adding
 * a gate means adding one entry rather than inventing wording at the call site.
 */
export const UPGRADE_COPY: Record<
  string,
  { title: string; body: string }
> = {
  'habits.unlimited': {
    title: "You've reached the free habit limit.",
    body: 'Premium removes the cap entirely. Prayers never count towards it.',
  },
  'favorites.unlimited': {
    title: "You've saved all your free places.",
    body: 'Premium lets you save as many businesses and offers as you like.',
  },
  'deals.premium': {
    title: 'This is a member-only offer.',
    body: 'Premium unlocks member-only deals from listings in your city.',
  },
  'assistant.generators': {
    title: 'Plan generators are a Premium feature.',
    body: 'You can still chat with the assistant on the free plan.',
  },
  'stats.fullHistory': {
    title: 'Full history is a Premium feature.',
    body: 'The free plan shows the last seven days.',
  },
  'planner.monthView': {
    title: 'Month view is a Premium feature.',
    body: 'The free plan includes the day and week views.',
  },
  'data.export': {
    title: 'Data export is a Premium feature.',
    body: 'Download everything you have created as JSON.',
  },
  'templates.all': {
    title: 'Premium templates.',
    body: 'Ramadan, Umrah and seasonal templates are part of Premium.',
  },
}

export function upgradeCopyFor(feature: string) {
  return (
    UPGRADE_COPY[feature] ?? {
      title: 'This is a Premium feature.',
      body: 'Upgrade to unlock it.',
    }
  )
}
