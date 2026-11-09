'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FilterOption {
  slug: string
  name: string
  count: number
}

/**
 * Filters live in the URL.
 *
 * Every control writes to the query string and the server re-renders from it, so
 * refresh, deep links, the back button and sharing all behave. Nothing is held
 * in component state except the in-flight search text.
 */
function useFilterNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function apply(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }

    // Any filter change resets to the first page — page 7 of the old result set
    // is meaningless against a new one.
    if (!('page' in updates)) params.delete('page')

    const query = params.toString()
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return { apply, pending, searchParams }
}

export function SearchField({ placeholder = 'Search businesses' }: { placeholder?: string }) {
  const { apply, searchParams } = useFilterNavigation()
  const initial = searchParams.get('q') ?? ''

  const [value, setValue] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep in step when the URL changes from elsewhere — a category chip, the back
  // button, a cleared filter. This is React's documented way to adjust state
  // when a prop changes: compare against the previous value during render, so
  // there is no effect and no cascading second render.
  const [lastUrlQuery, setLastUrlQuery] = useState(initial)
  if (initial !== lastUrlQuery) {
    setLastUrlQuery(initial)
    setValue(initial)
  }

  function onChange(next: string) {
    setValue(next)

    // Debounced so typing does not fire a query per keystroke.
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => apply({ q: next.trim() || null }), 350)
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-9 pe-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue('')
            if (timer.current) clearTimeout(timer.current)
            apply({ q: null })
          }}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Category chips.
 *
 * A horizontally scrolling list, but built as real buttons in a labelled group
 * so it stays keyboard-navigable and announces itself — a carousel that traps
 * keyboard users is not an acceptable trade for a mobile nicety.
 */
export function CategoryChips({ categories }: { categories: FilterOption[] }) {
  const { apply, searchParams } = useFilterNavigation()
  const active = searchParams.get('category')

  if (categories.length === 0) return null

  return (
    <div
      className="scrollbar-subtle -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="Filter by category"
    >
      <Chip label="All" active={!active} onClick={() => apply({ category: null })} />
      {categories.map((category) => (
        <Chip
          key={category.slug}
          label={category.name}
          count={category.count}
          active={active === category.slug}
          onClick={() =>
            apply({ category: active === category.slug ? null : category.slug })
          }
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
      )}
    >
      {label}
      {count !== undefined ? (
        <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>{count}</span>
      ) : null}
    </button>
  )
}

export function CitySelect({
  cities,
  allLabel = 'All cities',
}: {
  cities: { slug: string; name: string; countryName: string; count: number }[]
  allLabel?: string
}) {
  const { apply, searchParams } = useFilterNavigation()
  const active = searchParams.get('city') ?? '__all'

  return (
    <Select
      value={active}
      onValueChange={(value) => apply({ city: value === '__all' ? null : value })}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label="Filter by city">
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{allLabel}</SelectItem>
        {cities.map((city) => (
          <SelectItem key={city.slug} value={city.slug}>
            {city.name} · {city.countryName} ({city.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Removable summary of what is currently filtered. */
export function ActiveFilters({
  categories,
  cities,
}: {
  categories: FilterOption[]
  cities: { slug: string; name: string }[]
}) {
  const { apply, searchParams } = useFilterNavigation()

  const q = searchParams.get('q')
  const category = searchParams.get('category')
  const city = searchParams.get('city')
  const favourites = searchParams.get('favourites')

  const chips = [
    q ? { key: 'q', label: `“${q}”` } : null,
    category
      ? { key: 'category', label: categories.find((c) => c.slug === category)?.name ?? category }
      : null,
    city ? { key: 'city', label: cities.find((c) => c.slug === city)?.name ?? city } : null,
    favourites ? { key: 'favourites', label: 'Saved only' } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null)

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply({ [chip.key]: null })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {chip.label}
          <X className="size-3" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      {chips.length > 1 ? (
        <button
          type="button"
          onClick={() => apply({ q: null, category: null, city: null, favourites: null })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}

/** Server-rendered page links, so pagination works without JavaScript. */
export function FavouritesToggle() {
  const { apply, searchParams } = useFilterNavigation()
  const active = searchParams.get('favourites') === '1'

  return (
    <Chip
      label="Saved"
      active={active}
      onClick={() => apply({ favourites: active ? null : '1' })}
    />
  )
}
