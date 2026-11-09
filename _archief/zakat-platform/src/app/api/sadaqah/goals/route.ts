import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  createSadaqahGoal,
  listSadaqahGoalProgress,
} from '@/server/modules/donations/sadaqah-service'
import { sadaqahGoalCreateSchema } from '@/modules/donations/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  return ok({ goals: await listSadaqahGoalProgress(actor) })
})

export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('sadaqah-goals', actor.userId, request), RATE_LIMITS.write)

  const input = sadaqahGoalCreateSchema.parse(await request.json())
  return created(await createSadaqahGoal(actor, input))
})

export const dynamic = 'force-dynamic'
