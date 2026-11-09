import { afterAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import { LESSONS, PLACEMENTS } from '@/content/learn'
import type { Answers } from '@/lib/learn/grading'
import type { Lesson } from '@/lib/learn/lesson-schema'
import { ConflictError, EntitlementError, NotFoundError, ValidationError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'
import {
  completeLesson,
  getLearnOverview,
  getLessonForPlay,
  getNextLesson,
  getPracticeSet,
  submitPractice,
  visibleLessons,
} from '@/server/modules/learn/learn.service'
import {
  createChildProfile,
  deleteChildProfile,
  ensureSelfProfile,
  listLearners,
  MAX_CHILD_PROFILES,
  requireLearner,
  resolveLearner,
  skipPlacement,
  submitPlacement,
} from '@/server/modules/learn/learner.service'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn('\n  [integration] TEST_DATABASE_URL is not set — learn integration tests were SKIPPED.\n')
}

// Noon in Brussels, so the local date is unambiguous.
const MONDAY = new Date('2026-10-19T11:00:00Z')
const TUESDAY = new Date('2026-10-20T11:00:00Z')
const SATURDAY = new Date('2026-10-24T11:00:00Z')

function perfect(lesson: Lesson): Answers {
  return Object.fromEntries(
    lesson.exercises.map((exercise) => {
      switch (exercise.type) {
        case 'choice':
        case 'truefalse':
          return [exercise.id, exercise.answer]
        case 'order':
          return [exercise.id, exercise.items.map((_, index) => index)]
        case 'match':
          return [exercise.id, exercise.pairs.map((_, index) => index)]
        case 'wordbuild':
          return [exercise.id, exercise.word.split('').map((_, index) => index)]
        case 'quickfire':
          return [exercise.id, exercise.items.map((item) => item.answer)]
      }
    }),
  )
}

const adults = visibleLessons(LESSONS, true, 'adults')
const kids = visibleLessons(LESSONS, true, 'kids')
const adultL1 = adults.filter((lesson) => lesson.level === 1)
const adultL2 = adults.filter((lesson) => lesson.level === 2)
const [first, second, third] = adultL1 as [Lesson, Lesson, Lesson]

describeIfDb('learn service', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function freshUser(plan: 'FREE' | 'PREMIUM' = 'FREE'): Promise<Actor> {
    const user = await createTestUser(
      `learn-${plan}-${Date.now()}-${Math.round(performance.now() * 1000)}@test.local`,
      plan,
    )
    created.push(user.id)
    return actorFor(user.id, user.email, plan)
  }

  it('has enough content for these tests', () => {
    expect(adultL1.length).toBeGreaterThanOrEqual(3)
    expect(adultL2.length).toBeGreaterThanOrEqual(1)
    expect(kids.length).toBeGreaterThanOrEqual(1)
  })

  // ── Lessons ────────────────────────────────────────────────────────────────

  it('awards XP on the first completion only', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)

    const once = await completeLesson(actor, me, first.slug, perfect(first), MONDAY)
    expect(once.firstTime).toBe(true)
    expect(once.correct).toBe(first.exercises.length)
    expect(once.xpAwarded).toBeGreaterThan(0)

    const again = await completeLesson(actor, me, first.slug, perfect(first), TUESDAY)
    expect(again.firstTime).toBe(false)
    expect(again.xpAwarded).toBe(0)
    expect(again.totalXp).toBe(once.totalXp)
  })

  it('updates a same-day replay instead of adding a row', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)

    await completeLesson(actor, me, first.slug, {}, MONDAY)
    const replay = await completeLesson(actor, me, first.slug, perfect(first), MONDAY)

    const rows = await testPrisma().lessonCompletion.findMany({ where: { userId: actor.userId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.correct).toBe(first.exercises.length)
    expect(rows[0]!.missed).toEqual([])
    // XP was decided on the first, all-wrong attempt; replaying cannot raise it.
    expect(rows[0]!.xp).toBe(10)
    expect(replay.firstTime).toBe(false)
  })

  it('grades on the server, whatever the client believes', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)
    const result = await completeLesson(actor, me, first.slug, {}, MONDAY)
    expect(result.correct).toBe(0)
  })

  it('limits Free accounts to two new lessons a day, across all profiles', async () => {
    const actor = await freshUser('FREE')
    const me = await ensureSelfProfile(actor)
    const child = await createChildProfile(actor, { name: 'Amina', ageGroup: 'KIDS' })

    await completeLesson(actor, me, first.slug, perfect(first), MONDAY)
    await completeLesson(actor, me, second.slug, perfect(second), MONDAY)

    const state = await getLessonForPlay(actor, me, third.slug, MONDAY)
    expect(state.locked).toBe(true)
    await expect(completeLesson(actor, me, third.slug, perfect(third), MONDAY)).rejects.toBeInstanceOf(
      EntitlementError,
    )
    // The child shares the account's daily allowance.
    const kidsLesson = kids.find((lesson) => lesson.level === 1)!
    await expect(
      completeLesson(actor, child, kidsLesson.slug, perfect(kidsLesson), MONDAY),
    ).rejects.toBeInstanceOf(EntitlementError)

    // Replays stay free.
    await expect(completeLesson(actor, me, first.slug, perfect(first), MONDAY)).resolves.toMatchObject({
      firstTime: false,
    })

    // A new day brings new lessons.
    const tomorrow = await completeLesson(actor, me, third.slug, perfect(third), TUESDAY)
    expect(tomorrow.firstTime).toBe(true)
  })

  it('locks higher levels, then levels up once a level is finished', async () => {
    const actor = await freshUser('PREMIUM')
    let me = await ensureSelfProfile(actor)
    const higher = adultL2[0]!

    const locked = await getLessonForPlay(actor, me, higher.slug, MONDAY)
    expect(locked.levelLocked).toBe(true)
    await expect(completeLesson(actor, me, higher.slug, perfect(higher), MONDAY)).rejects.toBeInstanceOf(
      ValidationError,
    )

    let last = null
    for (const lesson of adultL1) {
      last = await completeLesson(actor, me, lesson.slug, perfect(lesson), MONDAY)
    }
    expect(last?.leveledUp).toBe(true)
    expect(last?.level).toBe(2)
    expect(last?.nextSlug).toBe(higher.slug)

    me = await requireLearner(actor, me.id)
    expect(me.level).toBe(2)
    expect((await getLessonForPlay(actor, me, higher.slug, MONDAY)).levelLocked).toBe(false)

    for (const lesson of adultL2) {
      await completeLesson(actor, me, lesson.slug, perfect(lesson), MONDAY)
    }
    const overview = await getLearnOverview(actor, await requireLearner(actor, me.id), MONDAY)
    expect(overview.completedCount).toBe(adults.length)
    expect(overview.newLimit).toBeNull()
    expect(overview.nextLesson).toBeNull()
  })

  it('builds the rhythm from learning days', async () => {
    const actor = await freshUser('PREMIUM')
    const me = await ensureSelfProfile(actor)

    await completeLesson(actor, me, first.slug, perfect(first), MONDAY)
    await completeLesson(actor, me, second.slug, perfect(second), TUESDAY)

    const sameWeek = await getLearnOverview(actor, me, TUESDAY)
    expect(sameWeek.rhythm.current).toBe(2)
    expect(sameWeek.rhythm.learnedToday).toBe(true)

    // Tuesday → Saturday is four days: the run has lapsed.
    const later = await getLearnOverview(actor, me, SATURDAY)
    expect(later.rhythm.current).toBe(0)
    expect(later.rhythm.best).toBe(2)
  })

  it('suggests the next unfinished lesson', async () => {
    const actor = await freshUser()
    expect((await getNextLesson(actor))?.slug).toBe(first.slug)

    const me = await ensureSelfProfile(actor)
    await completeLesson(actor, me, first.slug, perfect(first), MONDAY)
    expect((await getNextLesson(actor))?.slug).toBe(second.slug)
  })

  it('refuses a lesson that does not exist, or is for another age group', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)
    await expect(completeLesson(actor, me, 'no-such-lesson', {}, MONDAY)).rejects.toBeInstanceOf(
      NotFoundError,
    )
    await expect(getLessonForPlay(actor, me, kids[0]!.slug, MONDAY)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('keeps one member’s progress away from another', async () => {
    const a = await freshUser()
    const b = await freshUser()

    await completeLesson(a, await ensureSelfProfile(a), first.slug, perfect(first), MONDAY)

    const overview = await getLearnOverview(b, await ensureSelfProfile(b), MONDAY)
    expect(overview.completedCount).toBe(0)
    expect(overview.xp).toBe(0)
  })

  // ── Profiles ───────────────────────────────────────────────────────────────

  it('creates child profiles, up to the limit, each with its own path', async () => {
    const actor = await freshUser('PREMIUM')
    const child = await createChildProfile(actor, { name: '  Yusuf ', ageGroup: 'TEENS' })
    expect(child).toMatchObject({ kind: 'CHILD', name: 'Yusuf', audience: 'teens', level: 1, placed: false })

    for (let index = 1; index < MAX_CHILD_PROFILES; index += 1) {
      await createChildProfile(actor, { name: `Kind ${index}`, ageGroup: 'KIDS' })
    }
    await expect(createChildProfile(actor, { name: 'One more', ageGroup: 'KIDS' })).rejects.toBeInstanceOf(
      ConflictError,
    )
    await expect(createChildProfile(actor, { name: '', ageGroup: 'KIDS' })).rejects.toBeInstanceOf(
      ValidationError,
    )
    await expect(createChildProfile(actor, { name: 'Adult', ageGroup: 'ADULTS' })).rejects.toBeInstanceOf(
      ValidationError,
    )

    const learners = await listLearners(actor)
    expect(learners[0]!.kind).toBe('SELF')
    expect(learners).toHaveLength(MAX_CHILD_PROFILES + 1)

    // A child's progress is its own.
    const teensLesson = visibleLessons(LESSONS, true, 'teens').find((lesson) => lesson.level === 1)!
    await completeLesson(actor, child, teensLesson.slug, perfect(teensLesson), MONDAY)
    expect((await getLearnOverview(actor, child, MONDAY)).completedCount).toBe(1)
    expect((await getLearnOverview(actor, learners[0]!, MONDAY)).completedCount).toBe(0)
  })

  it('never hands out another account’s profile', async () => {
    const a = await freshUser()
    const b = await freshUser()
    const childOfA = await createChildProfile(a, { name: 'Sara', ageGroup: 'KIDS' })

    const resolved = await resolveLearner(b, childOfA.id)
    expect(resolved.kind).toBe('SELF')
    expect(resolved.id).not.toBe(childOfA.id)
    await expect(requireLearner(b, childOfA.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(deleteChildProfile(b, childOfA.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('removes a child with its progress, but never the holder’s own profile', async () => {
    const actor = await freshUser()
    const child = await createChildProfile(actor, { name: 'Adam', ageGroup: 'KIDS' })
    const kidsLesson = kids.find((lesson) => lesson.level === 1)!
    await completeLesson(actor, child, kidsLesson.slug, perfect(kidsLesson), MONDAY)

    await deleteChildProfile(actor, child.id)
    expect(await testPrisma().learnerProfile.count({ where: { id: child.id } })).toBe(0)
    expect(await testPrisma().lessonCompletion.count({ where: { learnerId: child.id } })).toBe(0)

    const me = await ensureSelfProfile(actor)
    await expect(deleteChildProfile(actor, me.id)).rejects.toBeInstanceOf(ValidationError)
  })

  // ── Placement ──────────────────────────────────────────────────────────────

  it('places a learner by the level test, graded on the server', async () => {
    const actor = await freshUser()
    const child = await createChildProfile(actor, { name: 'Maryam', ageGroup: 'TEENS' })
    const questions = PLACEMENTS.teens.questions

    const allRight = Object.fromEntries(questions.map((question) => [question.id, question.answer]))
    const top = await submitPlacement(actor, child.id, allRight)
    expect(top).toEqual({ correct: 5, total: 5, level: 3 })
    expect((await requireLearner(actor, child.id)).placed).toBe(true)

    const three = Object.fromEntries(
      questions.map((question, index) => [question.id, index < 3 ? question.answer : question.answer + 1]),
    )
    expect((await submitPlacement(actor, child.id, three)).level).toBe(2)
    expect((await submitPlacement(actor, child.id, {})).level).toBe(1)

    await expect(submitPlacement(actor, child.id, { q1: 'x' })).rejects.toBeInstanceOf(ValidationError)

    const me = await ensureSelfProfile(actor)
    const skipped = await skipPlacement(actor, me.id)
    expect(skipped).toMatchObject({ level: 1, placed: true })
  })

  // ── Practice ───────────────────────────────────────────────────────────────

  it('keeps mistakes for practice and crosses them off when answered right', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)

    const result = await completeLesson(actor, me, first.slug, {}, MONDAY)
    expect(result.correct).toBe(0)

    const set = await getPracticeSet(actor, me)
    expect(set.map((item) => item.exercise.id)).toEqual(first.exercises.map((exercise) => exercise.id))
    expect((await getLearnOverview(actor, me, MONDAY)).practiceCount).toBe(first.exercises.length)

    const answers = perfect(first)
    const [firstItem, ...rest] = set
    const partial = await submitPractice(actor, me, [
      { lessonSlug: first.slug, exerciseId: firstItem!.exercise.id, answer: answers[firstItem!.exercise.id] },
    ])
    expect(partial).toEqual({ correct: 1, total: 1, remaining: rest.length })

    // Practice earns no XP and records no learning day.
    const before = await testPrisma().lessonCompletion.count({ where: { learnerId: me.id } })
    const done = await submitPractice(
      actor,
      me,
      rest.map((item) => ({ lessonSlug: first.slug, exerciseId: item.exercise.id, answer: answers[item.exercise.id] })),
    )
    expect(done.remaining).toBe(0)
    expect(await testPrisma().lessonCompletion.count({ where: { learnerId: me.id } })).toBe(before)
    expect(await getPracticeSet(actor, me)).toEqual([])

    await expect(submitPractice(actor, me, 'nonsense')).rejects.toBeInstanceOf(ValidationError)
  })

  // ── Privacy ────────────────────────────────────────────────────────────────

  it('is removed, profiles included, when a member clears their activity', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)
    await createChildProfile(actor, { name: 'Ilyas', ageGroup: 'KIDS' })
    await completeLesson(actor, me, first.slug, perfect(first), MONDAY)

    const { clearActivity } = await import('@/server/modules/privacy/deletion.service')
    const result = await clearActivity(actor)

    expect(result.deleted.lessonCompletions).toBe(1)
    expect(result.deleted.learnerProfiles).toBe(2)
    expect(await testPrisma().lessonCompletion.count({ where: { userId: actor.userId } })).toBe(0)
    expect(await testPrisma().learnerProfile.count({ where: { userId: actor.userId } })).toBe(0)

    // Learning again simply starts a fresh profile.
    expect((await ensureSelfProfile(actor)).level).toBe(1)
  })

  it('exports profiles and progress', async () => {
    const actor = await freshUser()
    const me = await ensureSelfProfile(actor)
    await createChildProfile(actor, { name: 'Hana', ageGroup: 'TEENS' })
    await completeLesson(actor, me, first.slug, {}, MONDAY)

    const { buildDataExport } = await import('@/server/modules/privacy/export.service')
    const data = (await buildDataExport(actor)) as unknown as {
      sections: { learnerProfiles: { name: string | null; ageGroup: string }[]; lessonCompletions: { missed: string[] }[] }
    }
    expect(data.sections.learnerProfiles.map((profile) => profile.ageGroup)).toEqual(['ADULTS', 'TEENS'])
    expect(data.sections.learnerProfiles[1]!.name).toBe('Hana')
    expect(data.sections.lessonCompletions[0]!.missed.length).toBe(first.exercises.length)
  })
})
