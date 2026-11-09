import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { findPropertiesByIds } from '@/modules/search/repository'
import {
  compareProperties,
  MAX_COMPARE,
  type ComparableProperty,
} from '@/modules/property/domain/comparison'
import { prisma } from '@/server/db/prisma'
import { withErrorHandling } from '@/server/api/handler'

/** /api/properties/compare?ids=a,b,c */
export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()

  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE)

  const properties = await findPropertiesByIds(ids)

  // Alleen de scores van déze gebruiker; nooit die van iemand anders.
  const matches = await prisma.propertyMatch.findMany({
    where: { userId, propertyId: { in: ids } },
    orderBy: { score: 'desc' },
    select: { propertyId: true, score: true },
  })
  const scores = new Map<string, number>()
  for (const match of matches) {
    if (!scores.has(match.propertyId)) scores.set(match.propertyId, match.score)
  }

  const comparable: ComparableProperty[] = properties.map((property) => ({
    id: property.id,
    title: property.title,
    city: property.city,
    imageUrl: property.imageUrl,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingAreaM2: property.livingAreaM2,
    landAreaM2: property.landAreaM2,
    epcLabel: property.epcLabel,
    buildYear: property.buildYear,
    features: property.features,
    matchScore: scores.get(property.id) ?? null,
  }))

  return NextResponse.json({ comparison: compareProperties(comparable) })
})
