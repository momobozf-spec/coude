import type { NextRequest } from 'next/server'

import { requireAdmin } from '@/server/auth/actor'
import { created, handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { upsertClaim } from '@/server/modules/charities/admin-service'
import { upsertClaimSchema } from '@/modules/charities/schemas'

/**
 * Record or supersede a claim. Admin-only, and the service rejects evidence
 * that does not support what it is attached to (§11, §21).
 */
export const POST = handler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('charity-admin', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = upsertClaimSchema.parse(await request.json())

  return created(await upsertClaim(actor, id, input))
})

export const dynamic = 'force-dynamic'
