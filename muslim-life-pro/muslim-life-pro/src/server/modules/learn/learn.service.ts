import 'server-only'

import { z } from 'zod'

import { LESSONS } from '@/content/learn'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { EntitlementError, NotFoundError, ValidationError } from '@/lib/errors'
import { isoDateToUtcDate, todayIn, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import {
  answerValueSchema,
  gradeLesson,
  isCorrect,
  levelAfter,
  levelFor,
  xpFor,
  type Answers,
  type LevelInfo,
} from '@/lib/learn/grading'
import {
  LESSON_THEMES,
  LEVELS_PER_AUDIENCE,
  isReviewed,
  lessonLocaleFor,
  type Audience,
  type Exercise,
  type Lesson,
  type LessonLocale,
  type LessonTheme,
} from '@/lib/learn/lesson-schema'
import { computeRhythm, type Rhythm } from '@/lib/learn/rhythm'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { hasEntitlement, limitsFor } from '@/server/services/entitlements'
import type { LearnerView } from '@/server/modules/learn/learner.service'

// ─────────────────────────────────────────────────────────────────────────────
// Which lessons a learner may see
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draft lessons — religious content nobody qualified has signed off — are shown
 * in development and on test deployments that opt in with LEARN_SHOW_DRAFTS=1.
 * In production they do not exist for members until a named reviewer clears
 * them in the lesson file.
 */
export function showDrafts(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEARN_SHOW_DRAFTS === '1' || env.NODE_ENV !== 'production'
}

const THEME_INDEX = new Map<LessonTheme, number>(LESSON_THEMES.map((theme, index) => [theme, index]))

function byPath(a: Lesson, b: Lesson): number {
  return a.level - b.level || THEME_INDEX.get(a.theme)! - THEME_INDEX.get(b.theme)! || a.order - b.order
}

/** Visible lessons, optionally for one audience, in path order (level, theme, position). */
export function visibleLessons(
  lessons: readonly Lesson[] = LESSONS,
  includeDrafts: boolean = showDrafts(),
  audience?: Audience,
): Lesson[] {
  return lessons
    .filter((lesson) => includeDrafts || isReviewed(lesson))
    .filter((lesson) => audience === undefined || lesson.audience === audience)
    .sort(byPath)
}

function highestLevelWithLessons(lessons: readonly Lesson[]): number {
  return lessons.reduce((highest, lesson) => Math.max(highest, lesson.level), 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────────────────

export interface LessonSummary {
  slug: string
  theme: LessonTheme
  level: number
  order: number
  minutes: number
  title: string
  intro: string
  isDraft: boolean
  completed: boolean
  /** Above the learner's level: shown, but not playable yet. */
  locked: boolean
  /** Exercise types in the lesson, so the path can show which games it has. */
  games: Exercise['type'][]
}

export interface LevelGroup {
  level: number
  lessons: LessonSummary[]
}

export interface LearnOverview {
  locale: LessonLocale
  learner: LearnerView
  levels: LevelGroup[]
  totalCount: number
  completedCount: number
  xp: number
  progress: LevelInfo
  rhythm: Rhythm
  nextLesson: LessonSummary | null
  /** First completions on the account today, against the plan's daily limit. */
  newToday: number
  newLimit: number | null
  atDailyLimit: boolean
  hasDrafts: boolean
  /** Exercises answered wrongly and not yet put right — the practice queue. */
  practiceCount: number
}

function summarize(lesson: Lesson, locale: LessonLocale, completed: boolean, learnerLevel: number): LessonSummary {
  const text = lesson.text[locale]
  return {
    slug: lesson.slug,
    theme: lesson.theme,
    level: lesson.level,
    order: lesson.order,
    minutes: lesson.minutes,
    title: text.title,
    intro: text.intro,
    isDraft: !isReviewed(lesson),
    completed,
    locked: lesson.level > learnerLevel,
    games: [...new Set(lesson.exercises.map((exercise) => exercise.type))],
  }
}

/** An exercise in one language, as the lesson player renders it. */
export type LocalizedExercise =
  | {
      id: string
      type: 'choice'
      prompt: string
      options: string[]
      answer: number
      explanation: string
    }
  | { id: string; type: 'truefalse'; prompt: string; answer: boolean; explanation: string }
  | { id: string; type: 'order'; prompt: string; items: string[]; explanation: string }
  | {
      id: string
      type: 'match'
      prompt: string
      pairs: { left: string; right: string }[]
      explanation: string
    }
  | {
      id: string
      type: 'wordbuild'
      prompt: string
      word: string
      meaning: string
      explanation: string
    }
  | {
      id: string
      type: 'quickfire'
      prompt: string
      seconds: number
      items: { statement: string; answer: boolean }[]
      explanation: string
    }

export interface LessonView {
  slug: string
  theme: LessonTheme
  audience: Audience
  level: number
  minutes: number
  locale: LessonLocale
  isDraft: boolean
  title: string
  intro: string
  body: string[]
  takeaway: string
  key: { arabic: string; reference: string } | null
  sources: { kind: 'quran' | 'hadith' | 'scholar'; reference: string }[]
  exercises: LocalizedExercise[]
}

export function localizeExercise(exercise: Exercise, locale: LessonLocale): LocalizedExercise {
  switch (exercise.type) {
    case 'choice':
      return {
        id: exercise.id,
        type: 'choice',
        prompt: exercise.prompt[locale],
        options: exercise.options.map((option) => option[locale]),
        answer: exercise.answer,
        explanation: exercise.explanation[locale],
      }
    case 'truefalse':
      return {
        id: exercise.id,
        type: 'truefalse',
        prompt: exercise.prompt[locale],
        answer: exercise.answer,
        explanation: exercise.explanation[locale],
      }
    case 'order':
      return {
        id: exercise.id,
        type: 'order',
        prompt: exercise.prompt[locale],
        items: exercise.items.map((item) => item[locale]),
        explanation: exercise.explanation[locale],
      }
    case 'match':
      return {
        id: exercise.id,
        type: 'match',
        prompt: exercise.prompt[locale],
        pairs: exercise.pairs.map((pair) => ({ left: pair.left[locale], right: pair.right[locale] })),
        explanation: exercise.explanation[locale],
      }
    case 'wordbuild':
      return {
        id: exercise.id,
        type: 'wordbuild',
        prompt: exercise.prompt[locale],
        word: exercise.word,
        meaning: exercise.meaning[locale],
        explanation: exercise.explanation[locale],
      }
    case 'quickfire':
      return {
        id: exercise.id,
        type: 'quickfire',
        prompt: exercise.prompt[locale],
        seconds: exercise.seconds,
        items: exercise.items.map((item) => ({ statement: item.statement[locale], answer: item.answer })),
        explanation: exercise.explanation[locale],
      }
  }
}

export function toLessonView(lesson: Lesson, locale: LessonLocale): LessonView {
  const text = lesson.text[locale]
  return {
    slug: lesson.slug,
    theme: lesson.theme,
    audience: lesson.audience,
    level: lesson.level,
    minutes: lesson.minutes,
    locale,
    isDraft: !isReviewed(lesson),
    title: text.title,
    intro: text.intro,
    body: text.body,
    takeaway: text.takeaway,
    key: lesson.key ?? null,
    sources: lesson.sources,
    exercises: lesson.exercises.map((exercise) => localizeExercise(exercise, locale)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/** First completions today on the whole account (the free limit is per account). */
async function newLessonsToday(actor: Actor, today: IsoDate): Promise<number> {
  return prisma.lessonCompletion.count({
    where: { userId: actor.userId, localDate: isoDateToUtcDate(today), firstTime: true },
  })
}

/** The latest attempt per lesson that still has wrong answers. */
async function openMistakes(learnerId: string): Promise<Map<string, string[]>> {
  const rows = await prisma.lessonCompletion.findMany({
    where: { learnerId },
    orderBy: [{ localDate: 'desc' }, { updatedAt: 'desc' }],
    select: { lessonSlug: true, missed: true },
  })
  const latest = new Map<string, string[]>()
  for (const row of rows) {
    if (!latest.has(row.lessonSlug)) latest.set(row.lessonSlug, row.missed)
  }
  for (const [slug, missed] of latest) {
    if (missed.length === 0) latest.delete(slug)
  }
  return latest
}

async function learningState(actor: Actor, learner: LearnerView, today: IsoDate) {
  const [completedRows, dateRows, xpSum, newToday, mistakes] = await Promise.all([
    prisma.lessonCompletion.findMany({
      where: { learnerId: learner.id },
      select: { lessonSlug: true },
      distinct: ['lessonSlug'],
    }),
    prisma.lessonCompletion.findMany({
      where: { learnerId: learner.id },
      select: { localDate: true },
      distinct: ['localDate'],
      orderBy: { localDate: 'asc' },
    }),
    prisma.lessonCompletion.aggregate({
      where: { learnerId: learner.id },
      _sum: { xp: true },
    }),
    newLessonsToday(actor, today),
    openMistakes(learner.id),
  ])

  return {
    completed: new Set(completedRows.map((row) => row.lessonSlug)),
    xp: xpSum._sum.xp ?? 0,
    rhythm: computeRhythm(
      dateRows.map((row) => utcDateToIsoDate(row.localDate)),
      today,
    ),
    newToday,
    mistakes,
  }
}

function dailyLimit(actor: Actor): number | null {
  return hasEntitlement(actor, 'learn.unlimited') ? null : limitsFor(actor).newLessonsPerDay
}

export async function getLearnOverview(
  actor: Actor,
  learner: LearnerView,
  now: Date = new Date(),
): Promise<LearnOverview> {
  const locale = lessonLocaleFor(actor.locale)
  const today = todayIn(actor.timezone, now)
  const lessons = visibleLessons(LESSONS, showDrafts(), learner.audience)
  const state = await learningState(actor, learner, today)

  const summaries = lessons.map((lesson) =>
    summarize(lesson, locale, state.completed.has(lesson.slug), learner.level),
  )
  const levels: LevelGroup[] = LEVELS_PER_AUDIENCE.map((level) => ({
    level,
    lessons: summaries.filter((summary) => summary.level === level),
  }))

  const newLimit = dailyLimit(actor)
  const completedCount = summaries.filter((summary) => summary.completed).length
  const visibleSlugs = new Set(lessons.map((lesson) => lesson.slug))
  const practiceCount = [...state.mistakes]
    .filter(([slug]) => visibleSlugs.has(slug))
    .reduce((sum, [, missed]) => sum + missed.length, 0)

  await track(actor.userId, ANALYTICS_EVENTS.LEARN_OPENED, {
    completedCount,
    rhythm: state.rhythm.current,
  })

  return {
    locale,
    learner,
    levels,
    totalCount: summaries.length,
    completedCount,
    xp: state.xp,
    progress: levelFor(state.xp),
    rhythm: state.rhythm,
    nextLesson: summaries.find((summary) => !summary.completed && !summary.locked) ?? null,
    newToday: state.newToday,
    newLimit,
    atDailyLimit: newLimit !== null && state.newToday >= newLimit,
    hasDrafts: summaries.some((summary) => summary.isDraft),
    practiceCount,
  }
}

/**
 * The next lesson to suggest on My Day, for the account holder. Reads only:
 * an account that never opened Learn has no profile yet and gets the first
 * adult lesson.
 */
export async function getNextLesson(actor: Actor): Promise<LessonSummary | null> {
  const locale = lessonLocaleFor(actor.locale)
  const lessons = visibleLessons(LESSONS, showDrafts(), 'adults')
  if (lessons.length === 0) return null

  const self = await prisma.learnerProfile.findFirst({
    where: { userId: actor.userId, kind: 'SELF' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, level: true },
  })
  const level = self?.level ?? 1

  const done = new Set(
    self
      ? (
          await prisma.lessonCompletion.findMany({
            where: { learnerId: self.id },
            select: { lessonSlug: true },
            distinct: ['lessonSlug'],
          })
        ).map((row) => row.lessonSlug)
      : [],
  )
  const next = lessons.find((lesson) => !done.has(lesson.slug) && lesson.level <= level)
  return next ? summarize(next, locale, false, level) : null
}

export interface LessonPlayState {
  lesson: LessonView
  alreadyCompleted: boolean
  /** True when finishing this lesson would exceed today's free limit. */
  locked: boolean
  /** True when the lesson is above the learner's level. */
  levelLocked: boolean
  newLimit: number | null
  nextSlug: string | null
}

function findForLearner(slug: string, learner: LearnerView) {
  const lessons = visibleLessons(LESSONS, showDrafts(), learner.audience)
  const index = lessons.findIndex((lesson) => lesson.slug === slug)
  if (index === -1) throw new NotFoundError('Lesson')
  const nextPlayable = lessons
    .slice(index + 1)
    .find((lesson) => lesson.level <= Math.max(learner.level, lessons[index]!.level))
  return { lesson: lessons[index]!, lessons, nextSlug: nextPlayable?.slug ?? null }
}

export async function getLessonForPlay(
  actor: Actor,
  learner: LearnerView,
  slug: string,
  now: Date = new Date(),
): Promise<LessonPlayState> {
  const { lesson, nextSlug } = findForLearner(slug, learner)
  const locale = lessonLocaleFor(actor.locale)
  const today = todayIn(actor.timezone, now)

  const [previous, newToday] = await Promise.all([
    prisma.lessonCompletion.findFirst({
      where: { learnerId: learner.id, lessonSlug: slug },
      select: { id: true },
    }),
    newLessonsToday(actor, today),
  ])

  const newLimit = dailyLimit(actor)
  const alreadyCompleted = previous !== null

  return {
    lesson: toLessonView(lesson, locale),
    alreadyCompleted,
    locked: !alreadyCompleted && newLimit !== null && newToday >= newLimit,
    levelLocked: lesson.level > learner.level,
    newLimit,
    nextSlug,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice
// ─────────────────────────────────────────────────────────────────────────────

export interface PracticeItem {
  lessonSlug: string
  lessonTitle: string
  exercise: LocalizedExercise
}

export const PRACTICE_SET_SIZE = 8

/**
 * Exercises the learner got wrong on their latest attempt at each lesson.
 * Practice is for learning only: nothing is stored and no XP is given. Doing
 * the lesson again with every answer right clears the mistakes.
 */
export async function getPracticeSet(actor: Actor, learner: LearnerView): Promise<PracticeItem[]> {
  const locale = lessonLocaleFor(actor.locale)
  const lessons = new Map(
    visibleLessons(LESSONS, showDrafts(), learner.audience).map((lesson) => [lesson.slug, lesson]),
  )
  const mistakes = await openMistakes(learner.id)

  const items: PracticeItem[] = []
  for (const [slug, missed] of mistakes) {
    const lesson = lessons.get(slug)
    if (!lesson) continue
    for (const exercise of lesson.exercises) {
      if (missed.includes(exercise.id)) {
        items.push({
          lessonSlug: slug,
          lessonTitle: lesson.text[locale].title,
          exercise: localizeExercise(exercise, locale),
        })
      }
    }
  }
  return items.slice(0, PRACTICE_SET_SIZE)
}

export const practiceAnswersSchema = z
  .array(
    z.object({
      lessonSlug: z.string().max(80),
      exerciseId: z.string().max(40),
      answer: answerValueSchema,
    }),
  )
  .max(PRACTICE_SET_SIZE)

export interface PracticeResult {
  correct: number
  total: number
  /** Mistakes still open after this round. */
  remaining: number
}

/**
 * Grade a practice round on the server. A mistake answered right here is
 * crossed off the learner's latest attempt at that lesson. No XP, no rhythm:
 * practice is for remembering, not for points.
 */
export async function submitPractice(
  actor: Actor,
  learner: LearnerView,
  input: unknown,
): Promise<PracticeResult> {
  const parsed = practiceAnswersSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Invalid answers.')

  const lessons = new Map(
    visibleLessons(LESSONS, showDrafts(), learner.audience).map((lesson) => [lesson.slug, lesson]),
  )

  const fixedBySlug = new Map<string, Set<string>>()
  let correct = 0
  for (const item of parsed.data) {
    const exercise = lessons.get(item.lessonSlug)?.exercises.find((entry) => entry.id === item.exerciseId)
    if (!exercise) continue
    if (isCorrect(exercise, item.answer)) {
      correct += 1
      const fixed = fixedBySlug.get(item.lessonSlug) ?? new Set<string>()
      fixed.add(item.exerciseId)
      fixedBySlug.set(item.lessonSlug, fixed)
    }
  }

  for (const [slug, fixed] of fixedBySlug) {
    const latest = await prisma.lessonCompletion.findFirst({
      where: { learnerId: learner.id, lessonSlug: slug },
      orderBy: [{ localDate: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true, missed: true },
    })
    if (!latest) continue
    await prisma.lessonCompletion.update({
      where: { id: latest.id },
      data: { missed: latest.missed.filter((id) => !fixed.has(id)) },
    })
  }

  const open = await openMistakes(learner.id)
  let remaining = 0
  for (const [slug, missed] of open) if (lessons.has(slug)) remaining += missed.length

  return { correct, total: parsed.data.length, remaining }
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export interface CompletionResult {
  correct: number
  total: number
  results: Record<string, boolean>
  firstTime: boolean
  xpAwarded: number
  totalXp: number
  progress: LevelInfo
  rhythm: Rhythm
  nextSlug: string | null
  /** The learner's level after this lesson, and whether it just went up. */
  level: number
  leveledUp: boolean
}

/**
 * Record a finished lesson for one learner.
 *
 * Grades the raw answers against the lesson file, enforces the free daily limit
 * on *new* lessons (per account), awards XP only the first time this learner
 * finishes the lesson, and moves the learner up a level once every lesson of
 * their level is done. Replaying a lesson on the same day updates that day's row.
 */
export async function completeLesson(
  actor: Actor,
  learner: LearnerView,
  slug: string,
  answers: Answers,
  now: Date = new Date(),
): Promise<CompletionResult> {
  const { lesson, lessons } = findForLearner(slug, learner)
  if (lesson.level > learner.level) {
    throw new ValidationError('Finish the lessons of your current level first.')
  }

  const today = todayIn(actor.timezone, now)
  const localDate = isoDateToUtcDate(today)
  const grade = gradeLesson(lesson, answers)

  const { firstTime, xpAwarded } = await prisma.$transaction(async (tx) => {
    const previous = await tx.lessonCompletion.findFirst({
      where: { learnerId: learner.id, lessonSlug: slug },
      select: { id: true },
    })
    const isFirst = previous === null

    if (isFirst) {
      const limit = dailyLimit(actor)
      if (limit !== null) {
        const newToday = await tx.lessonCompletion.count({
          where: { userId: actor.userId, localDate, firstTime: true },
        })
        if (newToday >= limit) {
          throw new EntitlementError(
            'learn.unlimited',
            `You have finished ${limit} new lessons today. Come back tomorrow, or go Premium to keep learning.`,
          )
        }
      }
    }

    const xp = xpFor(grade.correct, isFirst)

    await tx.lessonCompletion.upsert({
      where: { learnerId_lessonSlug_localDate: { learnerId: learner.id, lessonSlug: slug, localDate } },
      create: {
        userId: actor.userId,
        learnerId: learner.id,
        lessonSlug: slug,
        localDate,
        correct: grade.correct,
        total: grade.total,
        xp,
        firstTime: isFirst,
        missed: grade.missed,
      },
      // A same-day replay updates the score and the mistakes; XP and
      // first-time status stay as they were, so replaying cannot farm points.
      update: { correct: grade.correct, total: grade.total, missed: grade.missed },
    })

    return { firstTime: isFirst, xpAwarded: xp }
  })

  const state = await learningState(actor, learner, today)

  // Level up once every lesson of the current level is finished.
  const atLevel = lessons.filter((entry) => entry.level === learner.level).map((entry) => entry.slug)
  const newLevel = levelAfter(learner.level, atLevel, state.completed, highestLevelWithLessons(lessons))
  if (newLevel !== learner.level) {
    await prisma.learnerProfile.update({ where: { id: learner.id }, data: { level: newLevel } })
  }

  // Suggest the first lesson still to do at the (possibly new) level.
  const nextSlug =
    lessons.find(
      (entry) => entry.slug !== slug && entry.level <= newLevel && !state.completed.has(entry.slug),
    )?.slug ?? null

  await track(actor.userId, ANALYTICS_EVENTS.LESSON_COMPLETED, {
    correct: grade.correct,
    questionCount: grade.total,
    firstTime,
    rhythm: state.rhythm.current,
  })

  return {
    correct: grade.correct,
    total: grade.total,
    results: grade.results,
    firstTime,
    xpAwarded,
    totalXp: state.xp,
    progress: levelFor(state.xp),
    rhythm: state.rhythm,
    nextSlug,
    level: newLevel,
    leveledUp: newLevel > learner.level,
  }
}
