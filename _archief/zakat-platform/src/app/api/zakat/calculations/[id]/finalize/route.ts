import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { finalizeCalculation } from '@/server/modules/zakat/calculation-service'

type Context = { params: Promise<{ id: string }> }

/**
 * Turn a draft into an immutable historical snapshot. Transactional, and a
 * second call returns 409 rather than restating history.
 */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-finalize', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  return ok(await finalizeCalculation(actor, id))
})

export const dynamic = 'force-dynamic'
