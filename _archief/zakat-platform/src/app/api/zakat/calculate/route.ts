import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { previewCalculation } from '@/server/modules/zakat/calculation-service'
import { calculationSettingsSchema } from '@/modules/zakat/schemas'

/**
 * Compute without storing. The wizard calls this to show a live result as the
 * user edits; nothing here creates history.
 */
export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculate', actor.userId, request), RATE_LIMITS.write)

  const body = await request.json().catch(() => ({}))
  const settings = calculationSettingsSchema.parse(body ?? {})

  const result = await previewCalculation(actor, {
    calculationDate: settings.calculationDate,
    currency: settings.currency,
    nisabBasis: settings.nisabBasis,
    customNisabValue: settings.customNisabValue,
    manualGoldPerGram: settings.manualGoldPerGram,
    manualSilverPerGram: settings.manualSilverPerGram,
  })

  return ok(result)
})

export const dynamic = 'force-dynamic'
