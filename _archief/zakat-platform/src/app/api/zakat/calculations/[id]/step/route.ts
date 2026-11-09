import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { saveWizardStep } from '@/server/modules/zakat/calculation-service'
import { wizardStepSchema } from '@/modules/zakat/schemas'

/**
 * Wizard autosave (§19).
 *
 * Position lives on the server, not in localStorage: a half-finished Zakat
 * calculation is financial data, and it has to survive a device change.
 */
export const PUT = handler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-wizard', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const { step } = wizardStepSchema.parse(await request.json())

  await saveWizardStep(actor, id, step)
  return noContent()
})

export const dynamic = 'force-dynamic'
