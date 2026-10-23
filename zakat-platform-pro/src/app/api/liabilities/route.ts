import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  createLiability,
  liabilityUsage,
  listLiabilities,
} from '@/server/modules/liabilities/service'
import { liabilityInputSchema } from '@/modules/zakat/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  const [liabilities, usage] = await Promise.all([
    listLiabilities(actor),
    liabilityUsage(actor),
  ])
  return ok({ liabilities, usage })
})

export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('liabilities', actor.userId, request), RATE_LIMITS.write)

  const input = liabilityInputSchema.parse(await request.json())
  return created(await createLiability(actor, input))
})

export const dynamic = 'force-dynamic'
