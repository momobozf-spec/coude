import Link from 'next/link'
import { FlaskConical, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Empty states that say what actually happened.
 *
 * "No results." tells a member nothing. Naming the category and the city, and
 * offering the specific filter to drop, turns a dead end into a next step.
 */
export function NoResults({
  categoryName,
  cityName,
  query,
  clearHref,
  hasFilters,
}: {
  categoryName?: string
  cityName?: string
  query?: string
  clearHref: string
  hasFilters: boolean
}) {
  const subject = categoryName ? categoryName.toLowerCase() : 'listings'
  const where = cityName ? ` in ${cityName}` : ''

  const title = query
    ? `Nothing matching “${query}”${where}`
    : `No ${subject} found${where}`

  return (
    <Card className="px-5 py-12 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-5 text-muted-foreground" aria-hidden />
      </span>

      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {hasFilters
          ? 'Try another category, pick a different city, or remove a filter.'
          : 'We are adding partners city by city. Nothing here yet.'}
      </p>

      {hasFilters ? (
        <Button variant="secondary" size="sm" className="mt-5" asChild>
          <Link href={clearHref}>Clear filters</Link>
        </Button>
      ) : null}
    </Card>
  )
}

/** Shown when a city genuinely has no seeded listings at all. */
export function NoListingsYet({ cityName }: { cityName?: string | null }) {
  return (
    <Card className="px-5 py-12 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted">
        <FlaskConical className="size-5 text-muted-foreground" aria-hidden />
      </span>

      <p className="mt-4 text-sm font-medium">
        {cityName ? `No demo listings for ${cityName} yet` : 'No demo listings here yet'}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        During early access, discovery is populated with clearly-marked demonstration data for a
        handful of cities. Real partner listings are added one city at a time.
      </p>

      <Button variant="secondary" size="sm" className="mt-5" asChild>
        <Link href="/app/explore/businesses">Browse all cities</Link>
      </Button>
    </Card>
  )
}

/**
 * The banner shown while everything in view is seed data.
 *
 * Per-card badges are necessary but not sufficient — a member scanning a grid
 * should be told once, plainly, before they read the listings as real.
 */
export function DemoDataNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken px-4 py-3">
      <FlaskConical className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">These are demonstration listings.</span>{' '}
        They show how discovery works and are not real businesses. Muslim Life has no
        partnerships or verified merchants yet — when it does, they will be labelled.
      </p>
    </div>
  )
}
