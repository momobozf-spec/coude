'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Button, Label, Select } from '@/components/ui'

/**
 * Directory filters (§16, §30).
 *
 * State lives in the URL, so filtering is server-side, shareable and works
 * without JavaScript once rendered. Every control has a real `<label>`, and the
 * form submits normally as a fallback.
 */

export interface FilterOptions {
  countries: readonly string[]
  causes: readonly { slug: string; name: string }[]
  showFavorites: boolean
}

export function CharityFilters({ options }: { options: FilterOptions }) {
  const router = useRouter()
  const params = useSearchParams()

  const value = (key: string) => params.get(key) ?? ''
  const checked = (key: string) => params.get(key) === 'true'

  function update(key: string, next: string | null) {
    const query = new URLSearchParams(params.toString())

    if (next === null || next === '') query.delete(key)
    else query.set(key, next)

    // Any filter change resets to the first page — page 4 of a different result
    // set is meaningless.
    query.delete('page')

    router.push(`/charities?${query.toString()}`)
  }

  const hasFilters = [...params.keys()].some((key) => key !== 'sort')

  return (
    <form
      role="search"
      aria-label="Goede doelen filteren"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-search">Zoeken op naam</Label>
          <input
            id="filter-search"
            name="search"
            type="search"
            defaultValue={value('search')}
            placeholder="Naam of omschrijving"
            className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base placeholder:text-muted focus-visible:border-primary"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                update('search', (event.target as HTMLInputElement).value)
              }
            }}
          />
          <p className="text-xs text-muted">Druk op Enter om te zoeken.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-country">Land</Label>
          <Select
            id="filter-country"
            value={value('country')}
            onChange={(e) => update('country', e.target.value)}
          >
            <option value="">Alle landen</option>
            {options.countries.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-cause">Doel</Label>
          <Select
            id="filter-cause"
            value={value('cause')}
            onChange={(e) => update('cause', e.target.value)}
          >
            <option value="">Alle doelen</option>
            {options.causes.map((cause) => (
              <option key={cause.slug} value={cause.slug}>
                {cause.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-sort">Sorteren op</Label>
          <Select
            id="filter-sort"
            value={value('sort') || 'name'}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="name">Naam</option>
            <option value="recent">Recent bijgewerkt</option>
            <option value="transparency">Transparantiescore</option>
          </Select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Verfijnen</legend>

        <Toggle
          id="filter-accepts-zakat"
          label="Accepteert Zakat (volgens een geregistreerde bron)"
          checked={checked('acceptsZakat')}
          onChange={(next) => update('acceptsZakat', next ? 'true' : null)}
        />

        <Toggle
          id="filter-zakat-policy"
          label="Heeft een gepubliceerd Zakat-beleid"
          checked={checked('zakatPolicyPublished')}
          onChange={(next) => update('zakatPolicyPublished', next ? 'true' : null)}
        />

        <Toggle
          id="filter-verified"
          label="Alleen organisaties met geverifieerde identiteit"
          checked={checked('verifiedOnly')}
          onChange={(next) => update('verifiedOnly', next ? 'true' : null)}
        />

        {options.showFavorites ? (
          <Toggle
            id="filter-favorites"
            label="Alleen mijn favorieten"
            checked={checked('favoritesOnly')}
            onChange={(next) => update('favoritesOnly', next ? 'true' : null)}
          />
        ) : null}

        <Toggle
          id="filter-demo"
          label="Toon ook fictieve demo-organisaties"
          checked={checked('includeDemo')}
          onChange={(next) => update('includeDemo', next ? 'true' : null)}
        />
      </fieldset>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => router.push('/charities')}
        >
          Filters wissen
        </Button>
      ) : null}
    </form>
  )
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-primary)]"
      />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  )
}
