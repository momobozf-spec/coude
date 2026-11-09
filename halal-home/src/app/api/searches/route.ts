import { NextResponse } from 'next/server'
import { SearchFrequency } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { listSearches } from '@/modules/search/repository'
import { createSearchFromQuery } from '@/modules/search/service'
import { withErrorHandling } from '@/server/api/handler'

export const GET = withErrorHandling(async () => {
  const userId = await requireUserId()
  return NextResponse.json({ searches: await listSearches(userId) })
})

const createSchema = z.object({
  query: z.string().trim().min(3).max(1000),
  name: z.string().trim().max(100).optional(),
  journeyId: z.string().nullish(),
  frequency: z.enum(SearchFrequency).optional(),
})

/**
 * Maakt een zoekopdracht uit vrije tekst.
 *
 * Draait hem niet meteen: dat doet de UI-action wel, maar een API-client wil
 * misschien eerst de geparste criteria zien voordat er bronnen bevraagd worden.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = createSchema.parse(await request.json())

  const result = await createSearchFromQuery(userId, input)
  return NextResponse.json(result, { status: 201 })
})
