import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { finalizeCalculation } from '@/server/modules/zakat/calculation-service'

type Context = { params: Promise<{ id: string }> }

/**
 * Freeze a draft into an immutable snapshot. A second call answers 409 rather
 * than restating a historical figure.
 */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  return ok(await finalizeCalculation(actor, id))
})

export const dynamic = 'force-dynamic'
