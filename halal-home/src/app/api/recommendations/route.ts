import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { getRecommendations } from '@/modules/journey/views'
import { findActiveJourney } from '@/modules/journey/repository'
import { MAX_RECOMMENDATIONS } from '@/modules/journey/domain/recommendations'
import { withErrorHandling } from '@/server/api/handler'
import { NotFoundError } from '@/lib/errors'

/**
 * /api/recommendations?journeyId=…&limit=…
 *
 * Deterministisch: dezelfde toestand geeft dezelfde lijst. Geen AI.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const journeyId =
    params.get('journeyId') ?? (await findActiveJourney(userId).then((j) => j?.id ?? null))
  if (!journeyId) throw new NotFoundError('Geen actief traject gevonden')

  const requested = Number(params.get('limit'))
  const limit =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, MAX_RECOMMENDATIONS)
      : MAX_RECOMMENDATIONS

  return NextResponse.json({ recommendations: await getRecommendations(userId, journeyId, limit) })
})
