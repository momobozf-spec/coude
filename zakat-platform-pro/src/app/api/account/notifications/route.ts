import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { setEmailReminders } from '@/server/modules/account/service'

const schema = z.object({ emailReminders: z.boolean() })

export const PATCH = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('account', actor.userId, request), RATE_LIMITS.write)

  const { emailReminders } = schema.parse(await request.json())
  await setEmailReminders(actor, emailReminders)
  return noContent()
})

export const dynamic = 'force-dynamic'
