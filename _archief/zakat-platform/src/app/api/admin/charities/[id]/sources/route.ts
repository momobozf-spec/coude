import type { NextRequest } from 'next/server'

import { requireAdmin } from '@/server/auth/actor'
import { created, handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { upsertSource } from '@/server/modules/charities/admin-service'
import { upsertSourceSchema } from '@/modules/charities/schemas'

/**
 * Admin-only (§21). `requireAdmin()` throws 403 for an ordinary signed-in user;
 * the proxy does not gate `/api`, so this check is the real boundary.
 */
export const POST = handler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('charity-admin', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = upsertSourceSchema.parse(await request.json())

  return created(await upsertSource(actor, id, input))
})

export const dynamic = 'force-dynamic'
