import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CharityFilters } from '@/modules/charities/filters'
import { CharityDirectory, DirectoryPagination } from '@/modules/charities/directory'
import { charityFilterSchema } from '@/modules/charities/schemas'
import { getActor } from '@/server/auth/actor'
import {
  getDirectoryFacets,
  listCharities,
} from '@/server/modules/charities/directory-service'
import { TRANSPARENCY_DISCLAIMER } from '@/server/modules/charities/transparency/factors'

export const metadata: Metadata = {
  title: 'Goede doelen',
  description:
    'Islamitische goede doelen met bronvermelding per claim: registratie, jaarverslag, financieel rapport en Zakat-beleid.',
}

/** Public on purpose: transparency information is worth nothing behind a login. */
export default async function PublicCharitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const actor = await getActor()

  const filter = charityFilterSchema.parse(flatten(params))

  const [page, facets] = await Promise.all([
    listCharities(filter, actor),
    getDirectoryFacets(),
  ])

  function hrefForPage(next: number) {
    const query = new URLSearchParams(flatten(params) as Record<string, string>)
    query.set('page', String(next))
    return `/charities?${query.toString()}`
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Goede doelen</h1>
      <p className="mt-2 text-muted">
        Elke uitspraak heeft een eigen bron. Wat wij zelf hebben gecontroleerd staat apart van
        wat een organisatie zelf opgeeft, en wat we niet weten heet gewoon onbekend.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <Suspense fallback={null}>
          <CharityFilters
            options={{
              countries: facets.countries,
              causes: facets.causes,
              showFavorites: Boolean(actor),
            }}
          />
        </Suspense>

        <CharityDirectory
          page={page}
          signedIn={Boolean(actor)}
          sortedByScore={filter.sort === 'transparency'}
        />

        <DirectoryPagination page={page} buildHref={hrefForPage} />

        <p className="border-t border-border pt-4 text-xs text-muted">{TRANSPARENCY_DISCLAIMER}</p>
      </div>
    </div>
  )
}

/** Next gives repeated query params as arrays; the schema expects scalars. */
function flatten(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === 'string' && first.length > 0) out[key] = first
  }
  return out
}

export const dynamic = 'force-dynamic'
