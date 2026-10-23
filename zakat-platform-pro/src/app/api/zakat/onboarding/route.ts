import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { saveOnboardingStep } from '@/server/modules/zakat/profile-service'
import { onboardingStepSchema } from '@/modules/zakat/schemas'

/** One step at a time, so leaving halfway keeps what was already answered. */
export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('onboarding', actor.userId, request), RATE_LIMITS.write)

  const input = onboardingStepSchema.parse(await request.json())
  return ok(await saveOnboardingStep(actor, input))
})

export const dynamic = 'force-dynamic'
