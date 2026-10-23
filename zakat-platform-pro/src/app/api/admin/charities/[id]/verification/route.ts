import type { NextRequest } from 'next/server'

import { requireAdmin } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { setCharityVerification } from '@/server/modules/charities/admin-service'
import { setVerificationSchema } from '@/modules/charities/schemas'

type Context = { params: Promise<{ id: string }> }

/**
 * Grant or withdraw the "geverifieerd" badge. Granting requires a verified
 * identity claim backed by an independent register; the service enforces that.
 */
export const PUT = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('admin-charities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const { verified, reason } = setVerificationSchema.parse(await request.json())
  await setCharityVerification(actor, id, verified, reason)
  return noContent()
})

export const dynamic = 'force-dynamic'
