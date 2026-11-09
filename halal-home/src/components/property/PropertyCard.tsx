import Link from 'next/link'
import { BedDouble, Bath, Maximize, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { formatEuro } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface PropertyCardData {
  id: string
  title: string
  city: string | null
  postalCode: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaM2: number | null
  epcLabel: string | null
  imageUrl: string | null
  matchScore?: number | null
}

/**
 * Eén woning in een lijst.
 *
 * Ontbrekende gegevens worden weggelaten, niet als "0" of "onbekend" getoond:
 * een advertentie zonder EPC is geen woning zonder EPC, en de matcher behandelt
 * dat verschil ook zo.
 */
export function PropertyCard({
  property,
  action,
}: {
  property: PropertyCardData
  action?: React.ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-[var(--surface)]">
      <Link href={`/properties/${property.id}`} className="block">
        {property.imageUrl ? (
          // Geen next/image: de bronnen zijn niet vooraf bekend, en elke host
          // whitelisten in next.config is een onderhoudslast die niets oplevert
          // zolang we de afbeeldingen niet transformeren.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.imageUrl}
            alt=""
            loading="lazy"
            className="h-44 w-full bg-[var(--color-sand-200)] object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-44 w-full items-center justify-center bg-[var(--color-sand-200)] text-sm text-[var(--muted)]"
          >
            Geen foto beschikbaar
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium leading-snug">{property.title}</h3>
              {(property.city || property.postalCode) && (
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {[property.postalCode, property.city].filter(Boolean).join(' ')}
                </p>
              )}
            </div>

            {property.matchScore !== null && property.matchScore !== undefined && (
              <Badge tone={property.matchScore >= 75 ? 'accent' : 'neutral'}>
                {property.matchScore}% match
              </Badge>
            )}
          </div>

          <p className="mt-2 text-lg font-semibold tabular-nums">
            {formatEuro(property.price)}
          </p>

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {property.bedrooms !== null && (
              <Spec icon={<BedDouble size={14} aria-hidden />} label="slaapkamers">
                {property.bedrooms}
              </Spec>
            )}
            {property.bathrooms !== null && (
              <Spec icon={<Bath size={14} aria-hidden />} label="badkamers">
                {property.bathrooms}
              </Spec>
            )}
            {property.livingAreaM2 !== null && (
              <Spec icon={<Maximize size={14} aria-hidden />} label="bewoonbare oppervlakte">
                {property.livingAreaM2} m²
              </Spec>
            )}
            {property.epcLabel && (
              <Spec icon={<Zap size={14} aria-hidden />} label="EPC-label">
                EPC {property.epcLabel}
              </Spec>
            )}
          </dl>
        </div>
      </Link>

      {action && <div className="border-t px-4 py-3">{action}</div>}
    </article>
  )
}

function Spec({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {icon}
      <span>
        {children}
        <span className="sr-only"> {label}</span>
      </span>
    </div>
  )
}

/** Compacte variant voor de vergelijkingskolommen. */
export function PropertyCardMini({ property }: { property: PropertyCardData }) {
  return (
    <Link href={`/properties/${property.id}`} className={cn('block')}>
      <p className="line-clamp-2 text-sm font-medium leading-snug">{property.title}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{formatEuro(property.price)}</p>
      {property.city && <p className="text-xs text-[var(--muted)]">{property.city}</p>}
    </Link>
  )
}
