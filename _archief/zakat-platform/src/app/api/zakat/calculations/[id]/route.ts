import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  discardDraft,
  readCalculation,
  recalculateDraft,
} from '@/server/modules/zakat/calculation-service'
import { calculationSettingsSchema } from '@/modules/zakat/schemas'

type Context = { params: Promise<{ id: string }> }

/**
 * Reads the stored row as-is. A finalised calculation is replayed from its own
 * items, never recomputed — that is what keeps history stable (§16).
 */
export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await readCalculation(actor, id))
})

/**
 * Recompute a draft. Rejected with 409 for a finalised calculation, so an
 * ordinary PATCH can never rewrite a snapshot (§26).
 */
export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const settings = calculationSettingsSchema.parse(body ?? {})

  return ok(await recalculateDraft(actor, id, settings))
})

export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  await discardDraft(actor, id)
  return noContent()
})

export const dynamic = 'force-dynamic'
