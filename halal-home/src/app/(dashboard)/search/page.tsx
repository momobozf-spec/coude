import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Search as SearchIcon } from 'lucide-react'

import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PropertyCard } from '@/components/property/PropertyCard'
import { SearchListActions } from './SearchListActions'
import { requireUserId } from '@/modules/auth/session'
import { listMatches, listSearches } from '@/modules/search/repository'
import { formatShortDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Zoeken' }

export default async function SearchPage() {
  const userId = await requireUserId()

  const [searches, matches] = await Promise.all([
    listSearches(userId),
    listMatches(userId, { onlyPassing: true, limit: 24 }),
  ])

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zoeken</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {searches.length === 0
              ? 'Beschrijf in gewone taal wat je zoekt.'
              : `${searches.length} ${searches.length === 1 ? 'zoekopdracht' : 'zoekopdrachten'}`}
          </p>
        </div>
        <ButtonLink href="/search/new" size="sm">
          <Plus size={16} aria-hidden />
          Nieuwe
        </ButtonLink>
      </header>

      {searches.length === 0 ? (
        <Card>
          <EmptyState
            title="Nog geen zoekopdrachten"
            description="Typ bijvoorbeeld: “huis rond Gent onder €450.000, minstens 3 slaapkamers, liefst EPC A of B en dichtbij een moskee”. Wij zetten dat om in criteria."
            action={
              <ButtonLink href="/search/new" size="lg">
                <SearchIcon size={16} aria-hidden />
                Maak je eerste zoekopdracht
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Mijn zoekopdrachten" />
          <ul className="space-y-2">
            {searches.map((search) => (
              <li key={search.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{search.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-[var(--muted)]">
                      “{search.originalQuery}”
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {search._count.matches}{' '}
                      {search._count.matches === 1 ? 'resultaat' : 'resultaten'}
                      {search.lastRunAt && ` · laatst gedraaid ${formatShortDate(search.lastRunAt)}`}
                    </p>
                  </div>
                  {!search.active && <Badge tone="muted">Gepauzeerd</Badge>}
                </div>

                <SearchListActions
                  searchId={search.id}
                  active={search.active}
                  alertsEnabled={search.alertsEnabled}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {matches.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Woningen die bij je passen
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {matches.map((match) => (
              <PropertyCard
                key={match.id}
                property={{
                  id: match.property.id,
                  title: match.property.title,
                  city: match.property.city,
                  postalCode: match.property.postalCode,
                  price: match.property.price,
                  bedrooms: match.property.bedrooms,
                  bathrooms: match.property.bathrooms,
                  livingAreaM2: match.property.livingAreaM2,
                  epcLabel: match.property.epcLabel,
                  imageUrl: match.property.imageUrl,
                  matchScore: match.score,
                }}
              />
            ))}
          </div>

          <p className="mt-4 text-center text-sm">
            <Link href="/saved" className="text-[var(--accent)] underline underline-offset-4">
              Bekijk je bewaarde woningen
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
