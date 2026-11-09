import type { Metadata } from 'next'
import Link from 'next/link'
import { GitCompare } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { PropertyCard } from '@/components/property/PropertyCard'
import { SavedStatusSelect } from './SavedStatusSelect'
import { requireUserId } from '@/modules/auth/session'
import { listSavedProperties } from '@/modules/search/repository'
import { MAX_COMPARE, MIN_COMPARE } from '@/modules/property/domain/comparison'

export const metadata: Metadata = { title: 'Bewaarde woningen' }

export default async function SavedPage() {
  const userId = await requireUserId()
  const saved = await listSavedProperties(userId)

  const compareIds = saved.slice(0, MAX_COMPARE).map((s) => s.propertyId)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bewaarde woningen</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {saved.length} {saved.length === 1 ? 'woning' : 'woningen'}
          </p>
        </div>

        {saved.length >= MIN_COMPARE && (
          <ButtonLink href={`/compare?ids=${compareIds.join(',')}`} variant="secondary" size="sm">
            <GitCompare size={15} aria-hidden />
            Vergelijk
          </ButtonLink>
        )}
      </header>

      {saved.length === 0 ? (
        <Card>
          <EmptyState
            title="Nog geen bewaarde woningen"
            description="Woningen die je bewaart, verschijnen hier. Zo kan je ze vergelijken en bezichtigingen plannen vanuit één overzicht."
            action={
              <ButtonLink href="/search" size="lg">
                Naar zoeken
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {saved.map((entry) => (
            <PropertyCard
              key={entry.id}
              property={{
                id: entry.property.id,
                title: entry.property.title,
                city: entry.property.city,
                postalCode: entry.property.postalCode,
                price: entry.property.price,
                bedrooms: entry.property.bedrooms,
                bathrooms: entry.property.bathrooms,
                livingAreaM2: entry.property.livingAreaM2,
                epcLabel: entry.property.epcLabel,
                imageUrl: entry.property.imageUrl,
              }}
              action={
                <SavedStatusSelect propertyId={entry.propertyId} status={entry.status} />
              }
            />
          ))}
        </div>
      )}

      {saved.length >= MIN_COMPARE && (
        <p className="text-center text-sm text-[var(--muted)]">
          Je kan{' '}
          <Link href={`/compare?ids=${compareIds.join(',')}`} className="underline underline-offset-4">
            {Math.min(saved.length, MAX_COMPARE)} woningen naast elkaar leggen
          </Link>
          .
        </p>
      )}
    </div>
  )
}
