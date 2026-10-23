import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { changePassword } from '@/server/modules/account/service'
import { changePasswordSchema } from '@/modules/auth/schemas'

/** Wachtwoord wijzigen. Alle sessies (ook deze) vervallen daarna. */
export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('account', actor.userId, request), RATE_LIMITS.auth)

  const input = changePasswordSchema.parse(await request.json())
  await changePassword(actor, input.currentPassword, input.newPassword)
  return noContent()
})

export const dynamic = 'force-dynamic'
