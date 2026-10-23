import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  getZakatPaymentSummary,
  registerZakatPayment,
} from '@/server/modules/donations/payment-service'
import { zakatPaymentSchema } from '@/modules/donations/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getZakatPaymentSummary(actor, id))
})

/** Type and calculation link are set by the service, never taken from the body. */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('donations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = zakatPaymentSchema.parse(await request.json())
  return created(await registerZakatPayment(actor, id, input))
})

export const dynamic = 'force-dynamic'
