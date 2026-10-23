import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  getOrCreateDraft,
  listCalculations,
} from '@/server/modules/zakat/calculation-service'
import { calculationSettingsSchema } from '@/modules/zakat/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  return ok({ calculations: await listCalculations(actor) })
})

/** Start (or resume) the wizard's draft. */
export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculations', actor.userId, request), RATE_LIMITS.write)

  const body = await request.json().catch(() => ({}))
  const settings = calculationSettingsSchema.parse(body ?? {})

  return created(await getOrCreateDraft(actor, settings))
})

export const dynamic = 'force-dynamic'
