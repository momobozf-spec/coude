import type { NextRequest } from 'next/server'

import { prisma } from '@/server/db/prisma'
import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { addFavorite, removeFavorite } from '@/server/modules/charities/favorites-service'
import { CharityNotFoundError } from '@/server/modules/charities/errors'

type Context = { params: Promise<{ slug: string }> }

async function resolveCharityId(slug: string): Promise<string> {
  const charity = await prisma.charity.findUnique({ where: { slug }, select: { id: true } })
  if (!charity) throw new CharityNotFoundError()
  return charity.id
}

/** Idempotent: favouriting twice succeeds twice and leaves one row (§14). */
export const PUT = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('favorites', actor.userId, request), RATE_LIMITS.write)

  const { slug } = await context.params
  await addFavorite(actor, await resolveCharityId(slug))

  return ok({ isFavorite: true })
})

export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('favorites', actor.userId, request), RATE_LIMITS.write)

  const { slug } = await context.params
  await removeFavorite(actor, await resolveCharityId(slug))

  return ok({ isFavorite: false })
})

export const dynamic = 'force-dynamic'
