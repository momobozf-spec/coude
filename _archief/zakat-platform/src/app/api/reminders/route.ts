import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { createReminder, listReminders } from '@/server/modules/reminders/service'
import { reminderCreateSchema } from '@/modules/reminders/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  return ok({ reminders: await listReminders(actor) })
})

export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('reminders', actor.userId, request), RATE_LIMITS.write)

  const input = reminderCreateSchema.parse(await request.json())
  return created(await createReminder(actor, input))
})

export const dynamic = 'force-dynamic'
