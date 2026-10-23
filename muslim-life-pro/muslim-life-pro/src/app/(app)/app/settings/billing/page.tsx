import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CreditCard, FlaskConical, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckoutButton, ManageSubscriptionButton } from '@/modules/billing/checkout-button'
import { requireActor } from '@/server/auth/actor'
import { getSubscription } from '@/server/modules/billing/billing.service'
import { getPublicPricing } from '@/server/modules/billing/pricing'
import { getPaymentsStatus } from '@/server/integrations/payments'
import { PLAN_FEATURES, PRICING } from '@/config/plans'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Billing',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Trial',
  PAST_DUE: 'Payment failed',
  CANCELED: 'Cancelled',
  INCOMPLETE: 'Incomplete',
}

export default async function BillingPage() {
  const actor = await requireActor()

  const [subscription, payments] = await Promise.all([
    getSubscription(actor),
    Promise.resolve(getPaymentsStatus()),
  ])

  const pricing = getPublicPricing()
  const isPremium = subscription.plan === 'PREMIUM' && subscription.isActive

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your plan, your billing period and how to change it."
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/settings">Settings</Link>
          </Button>
        }
      />

      {payments.configured && payments.isStub ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken px-4 py-3">
          <FlaskConical className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Demo billing.</span> No payment
            provider is connected, so nothing is charged. The full flow — checkout, webhooks,
            entitlements — is real and runs against a stub provider.
          </p>
        </div>
      ) : null}

      {!payments.configured ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3">
          <AlertTriangle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
          <p className="text-xs leading-relaxed text-danger">
            Billing is not configured on this deployment. Subscriptions cannot be started or
            managed until a payment provider is set up.
          </p>
        </div>
      ) : null}

      {/* Current plan */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">
                {isPremium ? t('pricing.premiumName') : t('pricing.freeName')}
              </h2>
              {isPremium ? (
                <Badge variant="accent" size="sm">
                  <Sparkles className="size-3" />
                  {t('common.premium')}
                </Badge>
              ) : null}
              {subscription.status !== 'ACTIVE' || subscription.plan === 'PREMIUM' ? (
                <Badge
                  variant={
                    subscription.status === 'PAST_DUE'
                      ? 'warning'
                      : subscription.status === 'CANCELED'
                        ? 'default'
                        : 'outline'
                  }
                  size="sm"
                >
                  {STATUS_LABELS[subscription.status] ?? subscription.status}
                </Badge>
              ) : null}
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              {subscription.interval ? (
                <Row label="Billing">
                  {subscription.interval === 'YEARLY' ? 'Yearly' : 'Monthly'}
                </Row>
              ) : null}

              {subscription.currentPeriodEnd ? (
                <Row label={subscription.cancelAtPeriodEnd ? 'Access until' : 'Next billing date'}>
                  {formatDate(utcDateToIsoDate(subscription.currentPeriodEnd), actor.locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Row>
              ) : null}

              {subscription.trialEndsAt ? (
                <Row label="Trial ends">
                  {formatDate(utcDateToIsoDate(subscription.trialEndsAt), actor.locale, {
                    day: 'numeric',
                    month: 'long',
                  })}
                </Row>
              ) : null}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            {subscription.hasProviderSubscription ? (
              <ManageSubscriptionButton size="sm" variant="secondary" />
            ) : payments.configured ? (
              <Button size="sm" asChild>
                <Link href="/pricing">{t('common.upgrade')}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {subscription.isEnding ? (
          <p className="mt-4 rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            Your subscription is set to end. You keep every Premium feature until{' '}
            {subscription.currentPeriodEnd
              ? formatDate(utcDateToIsoDate(subscription.currentPeriodEnd), actor.locale, {
                  day: 'numeric',
                  month: 'long',
                })
              : 'the end of the period'}
            , and nothing is lost before then.
          </p>
        ) : null}

        {subscription.inGracePeriod ? (
          <p className="mt-4 rounded-lg bg-warning-subtle px-3.5 py-3 text-xs leading-relaxed text-warning">
            The last payment did not go through. Your Premium features still work while we
            retry — update your payment method to avoid interruption.
          </p>
        ) : null}
      </Card>

      {/* Upgrade options, when not subscribed */}
      {!isPremium && payments.configured ? (
        <Card className="p-5">
          <h2 className="text-sm font-medium">Upgrade to Premium</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Unlimited habits and saved places, 500 assistant messages a month, the plan
            generators and member-only deals.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pricing.map((price) => (
              <div
                key={price.interval}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-display text-xl font-semibold tracking-[-0.02em]">
                    {PRICING.symbol}
                    {price.display}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {price.interval === 'YEARLY' ? '/year' : '/month'}
                    </span>
                  </p>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {price.currency}
                    {price.interval === 'YEARLY'
                      ? ` · save ${PRICING.yearlySavingPercent}%`
                      : ''}
                  </p>
                </div>

                {price.available ? (
                  <CheckoutButton
                    interval={price.interval}
                    label="Choose"
                    size="sm"
                    variant={price.interval === 'YEARLY' ? 'primary' : 'secondary'}
                  />
                ) : (
                  <Badge variant="outline" size="sm">
                    Unavailable
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* What the plan includes */}
      <Card className="p-5">
        <h2 className="text-sm font-medium">What you get</h2>
        <ul className="mt-3 space-y-2">
          {PLAN_FEATURES.map((feature) => {
            const value = isPremium ? feature.premium : feature.free
            const label = t(`pricing.features.${feature.key}` as never)

            return (
              <li
                key={feature.key}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="shrink-0 tabular-nums">
                  {value === true
                    ? t('pricing.values.included')
                    : value === false
                      ? '—'
                      : resolveValue(String(value))}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card variant="sunken" className="p-4">
        <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
          <CreditCard className="mt-px size-3.5 shrink-0" aria-hidden />
          Payment details are handled entirely by our payment provider. Muslim Life never sees
          or stores your card.
        </p>
      </Card>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function resolveValue(value: string): string {
  const key = `pricing.values.${value}`
  const translated = t(key as never)
  return translated === key ? value : translated
}
