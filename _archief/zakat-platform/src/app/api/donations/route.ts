import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  createDonation,
  donationYears,
  listDonations,
} from '@/server/modules/donations/service'
import { donationCreateSchema, donationFilterSchema } from '@/modules/donations/schemas'

export const GET = handler(async (request: NextRequest) => {
  const actor = await requireActor()

  const filter = donationFilterSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  const [donations, years] = await Promise.all([
    listDonations(actor, filter),
    donationYears(actor),
  ])

  return ok({ donations, years })
})

/**
 * Creating with the same `idempotencyKey` twice returns the original row with
 * 201 rather than registering a second payment (§37).
 */
export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('donations', actor.userId, request), RATE_LIMITS.write)

  const input = donationCreateSchema.parse(await request.json())
  return created(await createDonation(actor, input))
})

export const dynamic = 'force-dynamic'
