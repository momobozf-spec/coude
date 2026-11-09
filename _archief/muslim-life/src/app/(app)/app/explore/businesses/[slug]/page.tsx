import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Globe, Mail, Phone, Star, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BusinessHours } from '@/modules/discovery/business-hours'
import { BusinessMap } from '@/modules/discovery/business-map'
import { DealCard } from '@/modules/discovery/deal-card'
import { FavouriteButton } from '@/modules/discovery/favourite-button'
import { VerificationBadge } from '@/modules/discovery/discovery-badges'
import { requireActor } from '@/server/auth/actor'
import { getBusinessBySlug } from '@/server/modules/discovery/business.service'
import { listDealsForBusiness } from '@/server/modules/discovery/deal.service'
import { getBusinessMapData } from '@/server/integrations/maps'
import { NotFoundError } from '@/lib/errors'
import { formatDistance } from '@/lib/geo/distance'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    title: slug.replace(/-/g, ' '),
    robots: { index: false, follow: false },
  }
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const actor = await requireActor()
  const { slug } = await params

  let business
  try {
    business = await getBusinessBySlug(actor, slug)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const deals = await listDealsForBusiness(actor, business.id)

  const map = getBusinessMapData({
    name: business.name,
    address: business.address,
    postalCode: business.postalCode,
    cityName: business.cityName,
    countryName: business.countryName,
    latitude: business.latitude,
    longitude: business.longitude,
  })

  return (
    <div className="space-y-6">
      <Link
        href="/app/explore/businesses"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
        All businesses
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge
              verification={business.verification}
              isDemo={business.isDemo}
              lastVerifiedAt={business.lastVerifiedAt}
            />
            {business.tier === 'FEATURED' ? (
              <Badge variant="accent" size="sm">
                Featured
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em]">
            {business.name}
          </h1>

          <p className="mt-1.5 text-sm text-muted-foreground">
            {business.categoryName} · {business.cityName}
            {business.distanceKm !== null ? ` · ${formatDistance(business.distanceKm)}` : ''}
          </p>

          {business.rating !== null ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              <span className="font-medium tabular-nums">{business.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({business.reviewCount} {business.reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </p>
          ) : null}
        </div>

        <FavouriteButton
          kind="BUSINESS"
          targetId={business.id}
          isFavourite={business.isFavourite}
          label={business.name}
          variant="full"
        />
      </header>

      {business.isDemo ? (
        <Card variant="sunken" className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">This is a demonstration listing.</span>{' '}
            It is not a real business, and the contact details below are placeholders. It exists to
            show how business pages work during early access.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-sm font-medium">About</h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              {business.description}
            </p>
          </Card>

          {/* Deals */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Tag className="size-3.5 text-muted-foreground" aria-hidden />
              Offers
              <span className="text-xs font-normal text-muted-foreground">{deals.length}</span>
            </h2>

            {deals.length === 0 ? (
              <Card className="mt-3 px-5 py-8 text-center">
                <p className="text-sm font-medium">No active offers here right now</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save this business and we&apos;ll keep it handy for when one appears.
                </p>
              </Card>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} locale={actor.locale} />
                ))}
              </div>
            )}
          </section>

          <Card className="p-5">
            <BusinessHours
              hours={business.openingHours}
              timezone={business.timezone}
              openState={business.openState}
              memberTimezone={actor.timezone}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <BusinessMap map={map} name={business.name} />

          {/* Contact — only what actually exists. Nothing is invented. */}
          {business.phone || business.email || business.website ? (
            <Card className="p-5">
              <h2 className="text-sm font-medium">Contact</h2>
              <ul className="mt-3 space-y-2.5">
                {business.phone ? (
                  <ContactRow icon={Phone} label={business.phone} href={`tel:${business.phone}`} />
                ) : null}
                {business.email ? (
                  <ContactRow icon={Mail} label={business.email} href={`mailto:${business.email}`} />
                ) : null}
                {business.website ? (
                  <ContactRow
                    icon={Globe}
                    label={business.website.replace(/^https?:\/\//, '')}
                    href={business.website}
                    external
                  />
                ) : null}
              </ul>
            </Card>
          ) : null}

          <Card variant="sunken" className="p-4">
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              Listing source: {business.sourceType.toLowerCase()}.{' '}
              {business.lastVerifiedAt
                ? `Last checked ${business.lastVerifiedAt.toISOString().slice(0, 10)}.`
                : 'Not independently checked.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  href,
  external = false,
}: {
  icon: typeof Phone
  label: string
  href: string
  external?: boolean
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex items-center gap-2.5 text-sm text-foreground transition-colors hover:text-primary"
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {external ? <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </a>
    </li>
  )
}
