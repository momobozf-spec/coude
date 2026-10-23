import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { revokeAllSessions } from '@/server/modules/account/service'

/** "Overal afmelden": elke lopende sessie, op elk toestel, vervalt. */
export const DELETE = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('account', actor.userId, request), RATE_LIMITS.auth)

  await revokeAllSessions(actor)
  return noContent()
})

export const dynamic = 'force-dynamic'
