'use client'

import { useState, useTransition } from 'react'
import { SavedPropertyStatus } from '@prisma/client'

import { updateSavedStatusAction } from '@/modules/search/actions'

/**
 * De fase van een woning binnen het traject.
 *
 * Rijker dan "favoriet/afgewezen", omdat het aankoopproces zelf de reden is dat
 * dit platform bestaat: een woning waarop je een bod deed, is iets anders dan
 * een woning die je nog wil bezoeken.
 */
const LABELS: Record<SavedPropertyStatus, string> = {
  SAVED: 'Bewaard',
  SHORTLISTED: 'Op shortlist',
  VIEWING_PLANNED: 'Bezichtiging gepland',
  VISITED: 'Bezocht',
  OFFER_CONSIDERED: 'Bod overwegen',
  OFFERED: 'Bod uitgebracht',
  REJECTED: 'Afgewezen',
  PURCHASED: 'Gekocht',
  ARCHIVED: 'Gearchiveerd',
}

export function SavedStatusSelect({
  propertyId,
  status,
}: {
  propertyId: string
  status: SavedPropertyStatus
}) {
  const [current, setCurrent] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function change(next: SavedPropertyStatus) {
    const previous = current
    setCurrent(next)
    setError(null)

    startTransition(async () => {
      const result = await updateSavedStatusAction({ propertyId, status: next })
      if (!result.ok) {
        setCurrent(previous)
        setError(result.error ?? 'Er ging iets mis.')
      }
    })
  }

  return (
    <div>
      <label htmlFor={`status-${propertyId}`} className="sr-only">
        Status van deze woning
      </label>
      <select
        id={`status-${propertyId}`}
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value as SavedPropertyStatus)}
        className="min-h-9 w-full rounded-lg border bg-[var(--background)] px-2 text-sm"
      >
        {Object.entries(LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="mt-1 text-xs text-[var(--color-rust-deep)]">
          {error}
        </p>
      )}
    </div>
  )
}
