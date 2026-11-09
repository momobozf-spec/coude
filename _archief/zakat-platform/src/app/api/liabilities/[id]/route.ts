import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  deleteLiability,
  getLiability,
  updateLiability,
} from '@/server/modules/liabilities/service'
import { liabilityUpdateSchema } from '@/modules/zakat/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getLiability(actor, id))
})

export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('liabilities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = liabilityUpdateSchema.parse(await request.json())
  return ok(await updateLiability(actor, id, input))
})

export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('liabilities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  await deleteLiability(actor, id)
  return noContent()
})

export const dynamic = 'force-dynamic'
