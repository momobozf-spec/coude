import type { NextRequest } from 'next/server'

import { requireAdmin } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  recalculateTransparency,
  setCharityVerification,
} from '@/server/modules/charities/admin-service'
import { setVerificationSchema } from '@/modules/charities/schemas'

/**
 * Toggle the verification badge. Admin-only, and refused unless the identity
 * claim is verified against an independent register (§13).
 */
export const PUT = handler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('charity-admin', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = setVerificationSchema.parse(await request.json())

  await setCharityVerification(actor, id, input.verified, input.reason)

  return ok({ verified: input.verified })
})

/** Force a score refresh, e.g. after the scoring version changes (§23). */
export const POST = handler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('charity-admin', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  await recalculateTransparency(actor, id)

  return ok({ recalculated: true })
})

export const dynamic = 'force-dynamic'
