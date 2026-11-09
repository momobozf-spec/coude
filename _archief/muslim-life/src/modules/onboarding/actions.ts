'use server'

import { revalidatePath } from 'next/cache'

import { requireActor } from '@/server/auth/actor'
import { completeOnboarding } from '@/server/modules/account/account.service'
import { onboardingSchema } from '@/server/modules/account/account.schema'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'

export async function completeOnboardingAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const data = onboardingSchema.parse(input)

    await completeOnboarding(actor, data)

    revalidatePath('/app')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
