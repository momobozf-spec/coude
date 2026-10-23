import type { NextRequest } from 'next/server'

import { getActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { listCharities, getDirectoryFacets } from '@/server/modules/charities/directory-service'
import { charityFilterSchema } from '@/modules/charities/schemas'

/**
 * Public directory read (§21).
 *
 * No authentication required — transparency information is worth little behind a
 * login. An authenticated caller additionally gets `isFavorite` flags and may
 * use the favourites filter.
 */
export const GET = handler(async (request: NextRequest) => {
  const actor = await getActor()

  const filter = charityFilterSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  const [page, facets] = await Promise.all([
    listCharities(filter, actor),
    getDirectoryFacets(),
  ])

  return ok({ ...page, facets })
})

export const dynamic = 'force-dynamic'
