import 'server-only'

import type { LearnerAgeGroup, LearnerKind } from '@prisma/client'
import { z } from 'zod'

import { PLACEMENTS } from '@/content/learn'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors'
import { placementLevel } from '@/lib/learn/grading'
import type { Audience, LessonLocale } from '@/lib/learn/lesson-schema'

/**
 * Learner profiles: who on an account is learning.
 *
 * Every account has one SELF profile (created on first use). Account holders
 * are 16 or older, so their own profile is always the adult path. A parent can
 * add children — a nickname and an age group (6–9 or 10–15), nothing more.
 * Children learn on the parent's device under the parent's account; they have
 * no login, e-mail address or date of birth here.
 */

export const MAX_CHILD_PROFILES = 4

export const AGE_GROUP_AUDIENCE: Record<LearnerAgeGroup, Audience> = {
  KIDS: 'kids',
  TEENS: 'teens',
  ADULTS: 'adults',
}

export interface LearnerView {
  id: string
  kind: LearnerKind
  /** Child nickname; null for the account holder. */
  name: string | null
  ageGroup: LearnerAgeGroup
  audience: Audience
  level: number
  placed: boolean
}

const LEARNER_SELECT = {
  id: true,
  kind: true,
  name: true,
  ageGroup: true,
  level: true,
  placedAt: true,
} as const

type LearnerRow = {
  id: string
  kind: LearnerKind
  name: string | null
  ageGroup: LearnerAgeGroup
  level: number
  placedAt: Date | null
}

export function toLearnerView(row: LearnerRow): LearnerView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    ageGroup: row.ageGroup,
    audience: AGE_GROUP_AUDIENCE[row.ageGroup],
    level: Math.min(3, Math.max(1, row.level)),
    placed: row.placedAt !== null,
  }
}

/** The account holder's own profile, created the first time it is needed. */
export async function ensureSelfProfile(actor: Actor): Promise<LearnerView> {
  // Oldest first: should two requests ever race to create the profile, every
  // later read still settles on the same one.
  const existing = await prisma.learnerProfile.findFirst({
    where: { userId: actor.userId, kind: 'SELF' },
    orderBy: { createdAt: 'asc' },
    select: LEARNER_SELECT,
  })
  if (existing) return toLearnerView(existing)

  const created = await prisma.learnerProfile.create({
    data: { userId: actor.userId, kind: 'SELF', ageGroup: 'ADULTS', level: 1 },
    select: LEARNER_SELECT,
  })
  return toLearnerView(created)
}

/** All profiles on the account: the holder first, then children by age of the profile. */
export async function listLearners(actor: Actor): Promise<LearnerView[]> {
  const self = await ensureSelfProfile(actor)
  const children = await prisma.learnerProfile.findMany({
    where: { userId: actor.userId, kind: 'CHILD' },
    orderBy: { createdAt: 'asc' },
    select: LEARNER_SELECT,
  })
  return [self, ...children.map(toLearnerView)]
}

/**
 * The profile to learn as. An id that does not belong to this account — a
 * stale cookie, a tampered one — silently falls back to the holder's own.
 */
export async function resolveLearner(actor: Actor, requestedId: string | null | undefined): Promise<LearnerView> {
  if (requestedId) {
    const row = await prisma.learnerProfile.findFirst({
      where: { id: requestedId, userId: actor.userId },
      select: LEARNER_SELECT,
    })
    if (row) return toLearnerView(row)
  }
  return ensureSelfProfile(actor)
}

/** Like {@link resolveLearner}, but an unknown id is an error — for writes. */
export async function requireLearner(actor: Actor, learnerId: string): Promise<LearnerView> {
  const row = await prisma.learnerProfile.findFirst({
    where: { id: learnerId, userId: actor.userId },
    select: LEARNER_SELECT,
  })
  if (!row) throw new NotFoundError('Learner')
  return toLearnerView(row)
}

export const createChildSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the profile a name.')
    .max(30, 'Keep the name under 30 characters.'),
  ageGroup: z.enum(['KIDS', 'TEENS']),
})

export async function createChildProfile(actor: Actor, input: unknown): Promise<LearnerView> {
  const parsed = createChildSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid profile.')
  }

  const count = await prisma.learnerProfile.count({ where: { userId: actor.userId, kind: 'CHILD' } })
  if (count >= MAX_CHILD_PROFILES) {
    throw new ConflictError(`An account can have up to ${MAX_CHILD_PROFILES} child profiles.`)
  }

  const created = await prisma.learnerProfile.create({
    data: {
      userId: actor.userId,
      kind: 'CHILD',
      name: parsed.data.name,
      ageGroup: parsed.data.ageGroup,
      level: 1,
    },
    select: LEARNER_SELECT,
  })
  return toLearnerView(created)
}

/** Remove a child profile and, by cascade, everything it learned. */
export async function deleteChildProfile(actor: Actor, learnerId: string): Promise<void> {
  const learner = await requireLearner(actor, learnerId)
  if (learner.kind !== 'CHILD') throw new ValidationError('Your own profile cannot be removed here.')
  await prisma.learnerProfile.delete({ where: { id: learner.id } })
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement
// ─────────────────────────────────────────────────────────────────────────────

export interface PlacementQuestionView {
  id: string
  prompt: string
  options: string[]
}

/** The placement quiz for a learner, without the answers. */
export function placementFor(learner: LearnerView, locale: LessonLocale): PlacementQuestionView[] {
  return PLACEMENTS[learner.audience].questions.map((question) => ({
    id: question.id,
    prompt: question.prompt[locale],
    options: question.options.map((option) => option[locale]),
  }))
}

export const placementAnswersSchema = z.record(z.string().max(40), z.number().int().min(0).max(10))

export interface PlacementResult {
  correct: number
  total: number
  level: number
}

/** Grade the placement quiz on the server and set the learner's starting level. */
export async function submitPlacement(
  actor: Actor,
  learnerId: string,
  answers: unknown,
): Promise<PlacementResult> {
  const learner = await requireLearner(actor, learnerId)
  const parsed = placementAnswersSchema.safeParse(answers)
  if (!parsed.success) throw new ValidationError('Invalid answers.')

  const questions = PLACEMENTS[learner.audience].questions
  const correct = questions.filter((question) => parsed.data[question.id] === question.answer).length
  const level = placementLevel(correct)

  await prisma.learnerProfile.update({
    where: { id: learner.id },
    data: { level, placedAt: new Date() },
  })

  return { correct, total: questions.length, level }
}

/** Start at the first level without taking the quiz. */
export async function skipPlacement(actor: Actor, learnerId: string): Promise<LearnerView> {
  const learner = await requireLearner(actor, learnerId)
  const row = await prisma.learnerProfile.update({
    where: { id: learner.id },
    data: { level: 1, placedAt: new Date() },
    select: LEARNER_SELECT,
  })
  return toLearnerView(row)
}
