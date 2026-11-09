import Link from 'next/link'
import { MapPin, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FavouriteButton } from '@/modules/discovery/favourite-button'
import { OpenStateBadge, VerificationBadge } from '@/modules/discovery/discovery-badges'
import type { BusinessSummary } from '@/server/modules/discovery/business.service'
import { formatDistance } from '@/lib/geo/distance'
import { cn } from '@/lib/utils'

/**
 * Business card.
 *
 * Deliberately restrained: name, category, city, open state, distance, one deal
 * hint, trust badge. Everything else belongs on the detail page.
 */
export function BusinessCard({ business }: { business: BusinessSummary }) {
  return (
    <Card interactive className="group relative overflow-hidden">
      <Link
        href={`/app/explore/businesses/${business.slug}`}
        className="block focus-visible:outline-none"
      >
        <div
          className="relative h-28 bg-primary-subtle"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 16%, transparent) 1px, transparent 0)',
            backgroundSize: '16px 16px',
          }}
          aria-hidden
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-[-0.01em]">
                {business.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {business.categoryName} · {business.cityName}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <OpenStateBadge isOpen={business.openState.isOpen} label={business.openState.statusLabel} />

            {business.distanceKm !== null ? (
              <Badge variant="outline" size="sm">
                <MapPin />
                {formatDistance(business.distanceKm)}
              </Badge>
            ) : null}

            {business.activeDealCount > 0 ? (
              <Badge variant="accent" size="sm">
                <Tag />
                {business.activeDealCount} deal{business.activeDealCount === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3">
            <VerificationBadge
              verification={business.verification}
              isDemo={business.isDemo}
            />
          </div>
        </div>
      </Link>

      {/* Sits above the link so saving never navigates. */}
      <div className={cn('absolute end-3 top-3')}>
        <FavouriteButton
          kind="BUSINESS"
          targetId={business.id}
          isFavourite={business.isFavourite}
          label={business.name}
        />
      </div>
    </Card>
  )
}
