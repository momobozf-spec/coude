import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  archiveSadaqahGoal,
  getSadaqahGoalProgress,
  updateSadaqahGoal,
} from '@/server/modules/donations/sadaqah-service'
import { sadaqahGoalUpdateSchema } from '@/modules/donations/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getSadaqahGoalProgress(actor, id))
})

export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('sadaqah-goals', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = sadaqahGoalUpdateSchema.parse(await request.json())
  return ok(await updateSadaqahGoal(actor, id, input))
})

/** Archives rather than deletes, so past periods stay explainable. */
export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('sadaqah-goals', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  return ok(await archiveSadaqahGoal(actor, id))
})

export const dynamic = 'force-dynamic'
