'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Minus, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckoutButton, ManageSubscriptionButton } from '@/modules/billing/checkout-button'
import { PLAN_FEATURES, PRICING } from '@/config/plans'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

type Interval = 'MONTHLY' | 'YEARLY'

export interface PricingTableProps {
  currentPlan: 'FREE' | 'PREMIUM' | null
  signedIn: boolean
  /** True when the member has an active subscription right now. */
  isSubscribed: boolean
  /** True when they already have a provider customer to manage. */
  canManage: boolean
  /** Which intervals are actually purchasable, from server config. */
  availableIntervals: Interval[]
  paymentsConfigured: boolean
  isDemoBilling: boolean
}

/**
 * Pricing.
 *
 * The call to action reflects real state: a free member gets checkout, a
 * subscriber gets the portal, and someone looking at the plan they already have
 * gets neither. Starting a checkout for the current plan would charge someone
 * twice for the same thing.
 */
export function PricingTable({
  currentPlan,
  signedIn,
  isSubscribed,
  canManage,
  availableIntervals,
  paymentsConfigured,
  isDemoBilling,
}: PricingTableProps) {
  const [interval, setInterval] = useState<Interval>(
    availableIntervals.includes('YEARLY') ? 'YEARLY' : 'MONTHLY',
  )

  const price = interval === 'MONTHLY' ? PRICING.monthly : PRICING.yearly
  const suffix = interval === 'MONTHLY' ? t('pricing.perMonth') : t('pricing.perYear')
  const intervalAvailable = availableIntervals.includes(interval)

  return (
    <div className="mt-12">
      {isDemoBilling && signedIn ? (
        <p className="mb-6 rounded-xl border border-border bg-surface-sunken px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Demo billing.</span> No payment provider
          is connected on this deployment — nothing will be charged.
        </p>
      ) : null}

      {/* Interval toggle */}
      <div className="flex justify-center">
        <div
          className="inline-flex items-center gap-1 rounded-xl bg-muted p-1"
          role="group"
          aria-label="Billing interval"
        >
          {(['MONTHLY', 'YEARLY'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                interval === option
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option === 'MONTHLY' ? t('pricing.monthly') : t('pricing.yearly')}
              {option === 'YEARLY' ? (
                <Badge variant="success" size="sm">
                  {t('pricing.saveBadge', { percent: PRICING.yearlySavingPercent })}
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-7">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">{t('pricing.freeName')}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('pricing.freeDescription')}</p>
          </div>

          <p className="mt-6 font-display text-4xl font-semibold tracking-[-0.03em]">
            {PRICING.symbol}0
          </p>

          <div className="mt-6">
            {currentPlan === 'FREE' ? (
              <Button variant="secondary" size="lg" className="w-full" disabled>
                {t('pricing.currentPlan')}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" className="w-full" asChild>
                <Link href={signedIn ? '/app' : '/register'}>{t('pricing.startFree')}</Link>
              </Button>
            )}
          </div>
        </Card>

        <Card
          variant="flat"
          className="relative flex flex-col overflow-hidden border-primary/25 bg-primary-subtle p-7"
        >
          <div className="bg-geometric pointer-events-none absolute inset-0 opacity-40" aria-hidden />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-primary-subtle-foreground">
                {t('pricing.premiumName')}
              </h2>
              <Badge variant="accent" size="sm">
                <Sparkles className="size-3" />
                {t('common.premium')}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-primary-subtle-foreground/80">
              {t('pricing.premiumDescription')}
            </p>

            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-primary-subtle-foreground">
                {PRICING.symbol}
                {price.display}
              </span>
              <span className="text-sm text-primary-subtle-foreground/70">
                {suffix} · {PRICING.currency}
              </span>
            </p>

            <div className="mt-6">{renderPremiumCta()}</div>
          </div>
        </Card>
      </div>

      {/* Comparison */}
      <div className="mt-12 overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-lg border-collapse text-sm">
          <caption className="sr-only">Feature comparison between Free and Premium</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-3 text-start font-medium text-muted-foreground">
                Feature
              </th>
              <th scope="col" className="w-32 py-3 text-center font-medium text-muted-foreground">
                {t('common.free')}
              </th>
              <th scope="col" className="w-32 py-3 text-center font-medium text-primary">
                {t('common.premium')}
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((feature) => (
              <tr key={feature.key} className="border-b border-border">
                <th scope="row" className="py-3.5 pe-4 text-start font-normal text-foreground">
                  {t(`pricing.features.${feature.key}` as never)}
                </th>
                <td className="py-3.5 text-center text-muted-foreground">
                  <FeatureValue value={feature.free} />
                </td>
                <td className="py-3.5 text-center text-foreground">
                  <FeatureValue value={feature.premium} highlight />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  function renderPremiumCta() {
    if (!signedIn) {
      return (
        <Button size="lg" className="w-full" asChild>
          <Link href="/register">{t('pricing.goPremium')}</Link>
        </Button>
      )
    }

    // Already subscribed: never offer a second checkout for the same thing.
    if (isSubscribed) {
      return canManage ? (
        <ManageSubscriptionButton size="lg" className="w-full" />
      ) : (
        <Button size="lg" className="w-full" variant="secondary" disabled>
          {t('pricing.currentPlan')}
        </Button>
      )
    }

    if (!paymentsConfigured) {
      return (
        <Button size="lg" className="w-full" variant="secondary" disabled>
          Billing unavailable
        </Button>
      )
    }

    if (!intervalAvailable) {
      return (
        <Button size="lg" className="w-full" variant="secondary" disabled>
          Not available
        </Button>
      )
    }

    return (
      <CheckoutButton interval={interval} label={t('pricing.goPremium')} size="lg" className="w-full" />
    )
  }
}

function FeatureValue({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) {
    return (
      <>
        <Check
          className={cn('mx-auto size-4', highlight ? 'text-primary' : 'text-muted-foreground')}
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="sr-only">{t('pricing.values.included')}</span>
      </>
    )
  }

  if (value === false) {
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">{t('pricing.values.notIncluded')}</span>
      </>
    )
  }

  const key = `pricing.values.${value}`
  const translated = t(key as never)
  return <span className="tabular-nums">{translated === key ? value : translated}</span>
}
