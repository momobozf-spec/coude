'use server'

import { revalidatePath } from 'next/cache'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import {
  reflectionSchema,
  saveReflection,
  type ReflectionView,
} from '@/server/modules/reflection/reflection.service'
import { recomputeDailySummary } from '@/server/modules/my-day/my-day.service'

export async function saveReflectionAction(
  input: unknown,
): Promise<ActionResult<ReflectionView>> {
  try {
    const actor = await requireActor()
    const data = reflectionSchema.parse(input)

    const reflection = await saveReflection(actor, data)
    await recomputeDailySummary(actor, data.localDate)

    revalidatePath('/app')
    return actionOk(reflection)
  } catch (error) {
    return actionError(error)
  }
}
