import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FavouriteButton } from '@/modules/discovery/favourite-button'
import { PremiumDealBadge, VerificationBadge } from '@/modules/discovery/discovery-badges'
import type { DealSummary } from '@/server/modules/discovery/deal.service'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function DealCard({ deal, locale = 'en' }: { deal: DealSummary; locale?: string }) {
  return (
    <Card interactive className="group relative overflow-hidden">
      <Link href={`/app/explore/deals/${deal.id}`} className="block focus-visible:outline-none">
        <div className="p-4">
          <p
            className={cn(
              'font-display text-2xl font-semibold tracking-[-0.02em]',
              deal.isExpired && 'text-muted-foreground',
            )}
          >
            {deal.benefitLabel}
          </p>

          <h3 className="mt-1.5 truncate text-sm font-medium">{deal.title}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {deal.businessName} · {deal.cityName}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {deal.isExpired ? (
              <Badge variant="default" size="sm">
                Expired
              </Badge>
            ) : (
              <Badge variant="outline" size="sm">
                <CalendarClock />
                Until{' '}
                {formatDate(utcDateToIsoDate(deal.endsAt), locale, {
                  day: 'numeric',
                  month: 'short',
                })}
              </Badge>
            )}

            {deal.isPremiumOnly ? <PremiumDealBadge /> : null}
          </div>

          <div className="mt-3">
            <VerificationBadge verification={deal.isDemo ? 'DEMO' : 'UNVERIFIED'} isDemo={deal.isDemo} />
          </div>
        </div>
      </Link>

      <div className="absolute end-3 top-3">
        <FavouriteButton
          kind="DEAL"
          targetId={deal.id}
          isFavourite={deal.isFavourite}
          label={deal.title}
        />
      </div>
    </Card>
  )
}
