import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  expireClaim,
  upsertClaim,
  verifyClaim,
} from '@/server/modules/charities/admin-service'
import {
  charityClaimTypeEnum,
  upsertClaimSchema,
  verifyClaimSchema,
} from '@/modules/charities/schemas'

type Context = { params: Promise<{ id: string }> }

/** Record a new current claim; the previous one of that type is superseded, not edited. */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('admin-charities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = upsertClaimSchema.parse(await request.json())
  return created(await upsertClaim(actor, id, input))
})

const actionSchema = z.discriminatedUnion('action', [
  verifyClaimSchema.extend({ action: z.literal('verify'), type: charityClaimTypeEnum }),
  z.object({
    action: z.literal('expire'),
    type: charityClaimTypeEnum,
    reason: z.string().trim().max(300).optional(),
  }),
])

/** Verify a claim against a named source, or mark it as no longer evidenced. */
export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('admin-charities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const body = actionSchema.parse(await request.json())

  if (body.action === 'verify') {
    return ok(await verifyClaim(actor, id, body.type, body.sourceId, body.note))
  }
  return ok(await expireClaim(actor, id, body.type, body.reason))
})

export const dynamic = 'force-dynamic'
