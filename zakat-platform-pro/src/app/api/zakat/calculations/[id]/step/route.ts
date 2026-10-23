import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { saveWizardStep } from '@/server/modules/zakat/calculation-service'
import { wizardStepSchema } from '@/modules/zakat/schemas'

type Context = { params: Promise<{ id: string }> }

/** Persist the wizard position of a draft. Rejected for a finalised calculation. */
export const PUT = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('zakat-calculations', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const { step } = wizardStepSchema.parse(await request.json())
  await saveWizardStep(actor, id, step)
  return noContent()
})

export const dynamic = 'force-dynamic'
