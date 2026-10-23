import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { deleteAccount } from '@/server/modules/account/privacy'
import { deleteAccountSchema } from '@/modules/auth/schemas'

/** Account en alle eigen gegevens definitief wissen (AVG art. 17). */
export const DELETE = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('account', actor.userId, request), RATE_LIMITS.auth)

  const input = deleteAccountSchema.parse(await request.json())
  await deleteAccount(actor, input)
  return noContent()
})

export const dynamic = 'force-dynamic'
