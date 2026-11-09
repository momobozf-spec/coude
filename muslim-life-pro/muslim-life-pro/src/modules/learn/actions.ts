'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { answersSchema } from '@/lib/learn/grading'
import {
  completeLesson,
  submitPractice,
  type CompletionResult,
  type PracticeResult,
} from '@/server/modules/learn/learn.service'
import {
  createChildProfile,
  deleteChildProfile,
  requireLearner,
  skipPlacement,
  submitPlacement,
  type LearnerView,
  type PlacementResult,
} from '@/server/modules/learn/learner.service'
import {
  clearActiveLearnerCookie,
  getActiveLearner,
  setActiveLearnerCookie,
} from '@/server/modules/learn/active-learner'

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80)
const idSchema = z.string().min(1).max(64)

function revalidateLearn() {
  revalidatePath('/app')
  revalidatePath('/app/learn', 'layout')
}

/** Finish a lesson as the active learner. The server grades the answers. */
export async function completeLessonAction(input: unknown): Promise<ActionResult<CompletionResult>> {
  try {
    const actor = await requireActor()
    const { slug, answers } = z.object({ slug: slugSchema, answers: answersSchema }).parse(input)
    const learner = await getActiveLearner(actor)

    const result = await completeLesson(actor, learner, slug, answers)

    revalidateLearn()
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}

/** Switch who is learning on this device. */
export async function setActiveLearnerAction(input: unknown): Promise<ActionResult<LearnerView>> {
  try {
    const actor = await requireActor()
    const { learnerId } = z.object({ learnerId: idSchema }).parse(input)
    const learner = await requireLearner(actor, learnerId)

    await setActiveLearnerCookie(learner.id)
    revalidateLearn()
    return actionOk(learner)
  } catch (error) {
    return actionError(error)
  }
}

/** Add a child profile and make it the active learner. */
export async function createChildAction(input: unknown): Promise<ActionResult<LearnerView>> {
  try {
    const actor = await requireActor()
    const learner = await createChildProfile(actor, input)

    await setActiveLearnerCookie(learner.id)
    revalidateLearn()
    return actionOk(learner)
  } catch (error) {
    return actionError(error)
  }
}

/** Remove a child profile and its progress. */
export async function deleteChildAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { learnerId } = z.object({ learnerId: idSchema }).parse(input)
    const active = await getActiveLearner(actor)

    await deleteChildProfile(actor, learnerId)
    if (active.id === learnerId) await clearActiveLearnerCookie()

    revalidateLearn()
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function submitPlacementAction(input: unknown): Promise<ActionResult<PlacementResult>> {
  try {
    const actor = await requireActor()
    const { learnerId, answers } = z
      .object({ learnerId: idSchema, answers: z.unknown() })
      .parse(input)

    const result = await submitPlacement(actor, learnerId, answers)
    revalidateLearn()
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}

export async function skipPlacementAction(input: unknown): Promise<ActionResult<LearnerView>> {
  try {
    const actor = await requireActor()
    const { learnerId } = z.object({ learnerId: idSchema }).parse(input)

    const learner = await skipPlacement(actor, learnerId)
    revalidateLearn()
    return actionOk(learner)
  } catch (error) {
    return actionError(error)
  }
}

/** Grade a practice round; mistakes answered right are crossed off. */
export async function submitPracticeAction(input: unknown): Promise<ActionResult<PracticeResult>> {
  try {
    const actor = await requireActor()
    const learner = await getActiveLearner(actor)

    const result = await submitPractice(actor, learner, input)
    revalidateLearn()
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}
