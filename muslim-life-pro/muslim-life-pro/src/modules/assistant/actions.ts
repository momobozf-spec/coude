'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { enforce } from '@/server/services/rate-limit'
import { deleteConversation } from '@/server/modules/assistant/conversation.service'
import {
  generatePlan,
  type PlanView,
} from '@/server/modules/assistant/plan-generator.service'
import {
  applyGeneratedPlan,
  archivePlan,
  type ApplyResult,
} from '@/server/modules/assistant/plan-apply.service'
import { generatePlanInputSchema } from '@/server/modules/assistant/plan.schema'

/**
 * Assistant actions.
 *
 * Chat streams through `/api/assistant/stream` — a Server Action cannot return
 * a stream. These cover everything else.
 */

// The action allowlist lives in `@/lib/assistant/actions` — a Server Actions
// file may only export async functions.

export async function generatePlanAction(input: unknown): Promise<ActionResult<PlanView>> {
  try {
    const actor = await requireActor()
    await enforce('ai.generate', actor.userId)

    const data = generatePlanInputSchema.parse(input)
    const plan = await generatePlan(actor, data)

    revalidatePath('/app/assistant')
    return actionOk(plan)
  } catch (error) {
    return actionError(error)
  }
}

export async function applyPlanAction(input: unknown): Promise<ActionResult<ApplyResult>> {
  try {
    const actor = await requireActor()
    const result = await applyGeneratedPlan(actor, input)

    // The new items must be visible immediately everywhere they belong.
    revalidatePath('/app')
    revalidatePath('/app/planner')
    revalidatePath('/app/assistant')

    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}

export async function archivePlanAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { planId } = z.object({ planId: z.string().uuid() }).parse(input)

    await archivePlan(actor, planId)

    revalidatePath('/app/assistant')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteConversationAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { conversationId } = z.object({ conversationId: z.string().uuid() }).parse(input)

    await deleteConversation(actor, conversationId)

    revalidatePath('/app/assistant')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
