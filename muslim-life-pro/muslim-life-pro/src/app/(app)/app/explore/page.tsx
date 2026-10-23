import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Heart, MapPin, Store, Tag } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BusinessCard } from '@/modules/discovery/business-card'
import { DealCard } from '@/modules/discovery/deal-card'
import { CategoryChips, CitySelect, SearchField } from '@/modules/discovery/discovery-filters'
import { DemoDataNotice, NoListingsYet } from '@/modules/discovery/discovery-empty'
import { VerificationBadge } from '@/modules/discovery/discovery-badges'
import { requireActor } from '@/server/auth/actor'
import { getExplore } from '@/server/modules/discovery/discovery.service'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { formatBenefit } from '@/server/modules/discovery/deal.service'

export const metadata: Metadata = {
  title: 'Explore',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requireActor()
  const params = await searchParams

  const citySlug = typeof params.city === 'string' ? params.city : undefined
  const data = await getExplore(actor, { citySlug })

  const hasAnything = data.nearby.length > 0 || data.deals.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore"
        description="Halal food, butchers, bookshops and modest fashion — plus member offers."
      />

      {/* Search + city */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchField placeholder="Search businesses and deals" />
        </div>
        <CitySelect
          cities={data.cities.map((city) => ({
            slug: city.slug,
            name: city.name,
            countryName: city.countryName,
            count: city.count,
          }))}
        />
      </div>

      <CategoryChips
        categories={data.categories.map((category) => ({
          slug: category.slug,
          name: category.name,
          count: category.count,
        }))}
      />

      {data.allDemo ? <DemoDataNotice /> : null}

      {!hasAnything ? (
        <NoListingsYet cityName={data.activeCityName} />
      ) : (
        <>
          {/* Businesses */}
          {data.nearby.length > 0 ? (
            <section>
              <SectionHeading
                icon={Store}
                title={data.activeCityName ? `In ${data.activeCityName}` : 'Businesses'}
                count={data.totalListings}
                href={`/app/explore/businesses${data.activeCitySlug ? `?city=${data.activeCitySlug}` : ''}`}
              />
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.nearby.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Deals */}
          {data.deals.length > 0 ? (
            <section>
              <SectionHeading
                icon={Tag}
                title="Active offers"
                count={data.deals.length}
                href={`/app/explore/deals${data.activeCitySlug ? `?city=${data.activeCitySlug}` : ''}`}
              />
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} locale={actor.locale} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* Saved */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Heart className="size-3.5 text-muted-foreground" aria-hidden />
            Saved
          </h2>
          {data.favouriteCounts.limit !== null ? (
            <span className="text-xs text-muted-foreground">
              {data.favouriteCounts.total} of {data.favouriteCounts.limit} on the free plan
            </span>
          ) : null}
        </div>

        {data.favouriteBusinesses.length === 0 && data.favouriteDeals.length === 0 ? (
          <Card className="mt-3 px-5 py-8 text-center">
            <p className="text-sm font-medium">Nothing saved yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the heart on any business or offer to keep it here.
            </p>
          </Card>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {data.favouriteBusinesses.length > 0 ? (
              <Card className="p-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Businesses
                </h3>
                <ul className="mt-3 space-y-2">
                  {data.favouriteBusinesses.map(({ business }) => (
                    <li key={business.id}>
                      <Link
                        href={`/app/explore/businesses/${business.slug}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{business.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {business.category.name} · {business.city.name}
                          </span>
                        </span>
                        <VerificationBadge
                          verification={business.verification}
                          isDemo={business.isDemo}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {data.favouriteDeals.length > 0 ? (
              <Card className="p-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Offers
                </h3>
                <ul className="mt-3 space-y-2">
                  {data.favouriteDeals.map(({ deal }) => (
                    <li key={deal.id}>
                      <Link
                        href={`/app/explore/deals/${deal.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {formatBenefit(deal.discountType, deal.discountValue)} ·{' '}
                            {deal.business.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            Until{' '}
                            {formatDate(utcDateToIsoDate(deal.endsAt), actor.locale, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </span>
                        {deal.isPremiumOnly ? (
                          <Badge variant="accent" size="sm">
                            Premium
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      {data.activeCityName ? (
        <Card variant="sunken" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            Showing {data.activeCityName}. Distances are measured from your city, not your device.
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/settings">Change city</Link>
          </Button>
        </Card>
      ) : null}
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  count,
  href,
}: {
  icon: typeof Store
  title: string
  count: number
  href: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        {title}
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        See all
        <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
      </Link>
    </div>
  )
}
