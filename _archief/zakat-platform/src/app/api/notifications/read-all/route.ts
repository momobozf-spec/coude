import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { markAllRead } from '@/server/modules/notifications/service'

export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('notifications', actor.userId, request), RATE_LIMITS.write)

  return ok({ markedRead: await markAllRead(actor) })
})

export const dynamic = 'force-dynamic'
