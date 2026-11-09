import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check, Info, Minus } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { PropertyCardMini } from '@/components/property/PropertyCard'
import { requireUserId } from '@/modules/auth/session'
import { findPropertiesByIds } from '@/modules/search/repository'
import {
  compareProperties,
  ComparisonError,
  MAX_COMPARE,
  MIN_COMPARE,
  type ComparableProperty,
} from '@/modules/property/domain/comparison'
import { prisma } from '@/server/db/prisma'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Vergelijken' }

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const userId = await requireUserId()
  const { ids } = await searchParams

  const requested = (ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE)

  if (requested.length < MIN_COMPARE) {
    return (
      <div className="space-y-5">
        <BackLink />
        <Card>
          <EmptyState
            title="Kies woningen om te vergelijken"
            description={`Selecteer er minstens ${MIN_COMPARE} en hoogstens ${MAX_COMPARE} uit je bewaarde woningen.`}
            action={
              <ButtonLink href="/saved" size="sm">
                Naar bewaarde woningen
              </ButtonLink>
            }
          />
        </Card>
      </div>
    )
  }

  const properties = await findPropertiesByIds(requested)

  // De matchscores van déze gebruiker. Zo staat er in de vergelijking geen
  // score van iemand anders.
  const matches = await prisma.propertyMatch.findMany({
    where: { userId, propertyId: { in: requested } },
    orderBy: { score: 'desc' },
    select: { propertyId: true, score: true },
  })
  const scoreByProperty = new Map<string, number>()
  for (const match of matches) {
    if (!scoreByProperty.has(match.propertyId)) scoreByProperty.set(match.propertyId, match.score)
  }

  const comparable: ComparableProperty[] = properties.map((property) => ({
    id: property.id,
    title: property.title,
    city: property.city,
    imageUrl: property.imageUrl,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingAreaM2: property.livingAreaM2,
    landAreaM2: property.landAreaM2,
    epcLabel: property.epcLabel,
    buildYear: property.buildYear,
    features: property.features,
    matchScore: scoreByProperty.get(property.id) ?? null,
  }))

  let comparison
  try {
    comparison = compareProperties(comparable)
  } catch (error) {
    if (error instanceof ComparisonError) {
      return (
        <div className="space-y-5">
          <BackLink />
          <Card>
            <EmptyState title="Vergelijken lukt niet" description={error.message} />
          </Card>
        </div>
      )
    }
    throw error
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Vergelijken</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {comparison.properties.length} woningen naast elkaar
        </p>
      </header>

      {/* Horizontaal scrollen op mobiel: een tabel met vier kolommen past niet
          op 375 px, en samenpersen maakt hem onleesbaar. */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">
            Vergelijking van {comparison.properties.length} woningen. De gunstigste waarde per rij
            is gemarkeerd.
          </caption>

          <thead>
            <tr>
              <th scope="col" className="w-32 p-2 text-left align-bottom">
                <span className="sr-only">Kenmerk</span>
              </th>
              {comparison.properties.map((property) => (
                <th key={property.id} scope="col" className="p-2 text-left align-bottom">
                  <PropertyCardMini
                    property={{
                      id: property.id,
                      title: property.title,
                      city: property.city,
                      postalCode: null,
                      price: property.price,
                      bedrooms: null,
                      bathrooms: null,
                      livingAreaM2: null,
                      epcLabel: null,
                      imageUrl: property.imageUrl,
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key} className="border-t">
                <th scope="row" className="p-2 text-left align-top font-normal">
                  <span className="block text-[var(--muted)]">{row.label}</span>
                  {row.hint && (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.hint}</span>
                  )}
                </th>

                {row.cells.map((cell) => (
                  <td key={cell.propertyId} className="p-2 align-top">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 tabular-nums',
                        cell.best && 'font-semibold text-[var(--color-olive-700)]',
                      )}
                    >
                      {cell.display}
                      {/* Niet alleen kleur: het vinkje draagt dezelfde
                          informatie voor wie die kleur niet ziet. */}
                      {cell.best && <Check size={13} aria-label="gunstigste" />}
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            {comparison.featureRows.length > 0 && (
              <>
                <tr className="border-t">
                  <th
                    scope="row"
                    colSpan={comparison.properties.length + 1}
                    className="p-2 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
                  >
                    Kenmerken die verschillen
                  </th>
                </tr>
                {comparison.featureRows.map((row) => (
                  <tr key={row.feature} className="border-t">
                    <th scope="row" className="p-2 text-left align-top font-normal text-[var(--muted)]">
                      {row.feature.replace(/_/g, ' ')}
                    </th>
                    {comparison.properties.map((property) => (
                      <td key={property.id} className="p-2 align-top">
                        {row.present[property.id] ? (
                          <Check
                            size={15}
                            className="text-[var(--color-olive-600)]"
                            aria-label="aanwezig"
                          />
                        ) : (
                          <Minus size={15} className="text-[var(--muted)]" aria-label="niet vermeld" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        Wij wijzen geen beste woning aan. Per rij markeren we de gunstigste waarde, zodat je zelf
        kan wegen wat voor jou telt. Een streepje betekent dat de advertentie het niet vermeldt —
        dat zegt niets over de woning zelf.
      </p>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/saved"
      className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
    >
      <ArrowLeft size={14} aria-hidden />
      Bewaarde woningen
    </Link>
  )
}
