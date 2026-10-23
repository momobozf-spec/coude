import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { markRead } from '@/server/modules/notifications/service'

export const POST = handler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const actor = await requireActor()
  enforce(rateLimitKey('notifications', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  return ok(await markRead(actor, id))
})

export const dynamic = 'force-dynamic'
