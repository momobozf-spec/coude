import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { getZakatProfile, updateZakatProfile } from '@/server/modules/zakat/profile-service'
import { zakatProfileSchema } from '@/modules/zakat/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  return ok(await getZakatProfile(actor))
})

export const PATCH = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-profile', actor.userId, request), RATE_LIMITS.write)

  const input = zakatProfileSchema.parse(await request.json())
  return ok(await updateZakatProfile(actor, input))
})

export const dynamic = 'force-dynamic'
