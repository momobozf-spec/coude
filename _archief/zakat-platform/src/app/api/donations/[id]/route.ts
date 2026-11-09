import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  getDonation,
  updateDonation,
  voidDonation,
} from '@/server/modules/donations/service'
import { donationUpdateSchema, donationVoidSchema } from '@/modules/donations/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getDonation(actor, id))
})

export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('donations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = donationUpdateSchema.parse(await request.json())
  return ok(await updateDonation(actor, id, input))
})

/**
 * DELETE **voids** rather than erases (§7, §31).
 *
 * A registered donation is financial history: removing the row would leave a
 * past Zakat year unexplainable and the audit trail pointing at nothing. The
 * voided donation stops counting towards every total and returns 200 with the
 * updated record, so the caller can see the new state.
 */
export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('donations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const { reason } = donationVoidSchema.parse(body ?? {})

  return ok(await voidDonation(actor, id, reason))
})

export const dynamic = 'force-dynamic'
