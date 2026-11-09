import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, MapPin, Store } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FavouriteButton } from '@/modules/discovery/favourite-button'
import { PremiumDealBadge, VerificationBadge } from '@/modules/discovery/discovery-badges'
import { RedeemPanel } from '@/modules/discovery/redeem-panel'
import { requireActor } from '@/server/auth/actor'
import { getDealById } from '@/server/modules/discovery/deal.service'
import { NotFoundError } from '@/lib/errors'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Deal',
  robots: { index: false, follow: false },
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActor()
  const { id } = await params

  let deal
  try {
    deal = await getDealById(actor, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  return (
    <div className="space-y-6">
      <Link
        href="/app/explore/deals"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
        All deals
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge verification={deal.isDemo ? 'DEMO' : 'UNVERIFIED'} isDemo={deal.isDemo} />
            {deal.isPremiumOnly ? <PremiumDealBadge /> : null}
            {deal.isExpired ? (
              <Badge variant="default" size="sm">
                Expired
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em]">
            {deal.benefitLabel}
          </p>
          <h1 className="mt-1.5 text-lg font-medium">{deal.title}</h1>

          <Link
            href={`/app/explore/businesses/${deal.businessSlug}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Store className="size-3.5" aria-hidden />
            {deal.businessName} · {deal.cityName}
          </Link>
        </div>

        <FavouriteButton
          kind="DEAL"
          targetId={deal.id}
          isFavourite={deal.isFavourite}
          label={deal.title}
          variant="full"
        />
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-sm font-medium">About this offer</h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              {deal.description}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-medium">Validity</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Starts</dt>
                <dd className="tabular-nums">
                  {formatDate(utcDateToIsoDate(deal.startsAt), actor.locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Ends</dt>
                <dd className="tabular-nums">
                  {formatDate(utcDateToIsoDate(deal.endsAt), actor.locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              {deal.maxRedemptions !== null ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Claimed</dt>
                  <dd className="tabular-nums">
                    {deal.redemptionCount} of {deal.maxRedemptions}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {deal.terms ? (
            <Card className="p-5">
              <h2 className="text-sm font-medium">Terms</h2>
              <p className="mt-3 whitespace-pre-line text-pretty text-xs leading-relaxed text-muted-foreground">
                {deal.terms}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <RedeemPanel
            dealId={deal.id}
            canRedeem={deal.canRedeem}
            lockedReason={deal.lockedReason}
            existing={deal.redemption}
            isDemo={deal.isDemo}
          />

          <Card className="p-5">
            <h2 className="text-sm font-medium">Where to use it</h2>
            <address className="mt-3 not-italic text-sm leading-relaxed text-muted-foreground">
              {deal.businessAddress}
              <br />
              {deal.cityName}
            </address>
            <Link
              href={`/app/explore/businesses/${deal.businessSlug}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <MapPin className="size-3" aria-hidden />
              View business
            </Link>
          </Card>

          <Card variant="sunken" className="p-4">
            <p className="inline-flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
              <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
              Muslim Life has no partner agreements yet. Demonstration offers exist to show how
              deals work and are not honoured by any business.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
