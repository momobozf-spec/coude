import { z } from 'zod'

/**
 * The shape of a lesson file in `src/content/learn`.
 *
 * Isomorphic on purpose: the server validates every file at load (a broken file
 * fails the build, not a member's lesson), and the lesson player uses the same
 * types to render.
 *
 * Every piece of text exists in the three languages lessons are written in. A
 * member reading Arabic is served English until an Arabic lesson text exists —
 * machine-translating religious explanations into Arabic is not something this
 * product does.
 */

export const LESSON_LOCALES = ['nl', 'fr', 'en'] as const
export type LessonLocale = (typeof LESSON_LOCALES)[number]

/** The themes of the learning path, in the order they are shown. */
export const LESSON_THEMES = [
  'evidences',
  'prophets',
  'companions',
  'modern',
  'misconceptions',
  'quran',
  'differences',
  'rulings',
] as const
export type LessonTheme = (typeof LESSON_THEMES)[number]

/** Who a lesson is written for. Matches the learner profile's age group. */
export const AUDIENCES = ['kids', 'teens', 'adults'] as const
export type Audience = (typeof AUDIENCES)[number]

/** 1 = starter, 2 = advanced, 3 = deepening. */
export const LEVELS_PER_AUDIENCE = [1, 2, 3] as const
export type LessonLevel = (typeof LEVELS_PER_AUDIENCE)[number]

const text = z.string().trim().min(1)

export const localizedSchema = z.object({ nl: text, fr: text, en: text }).strict()
export type Localized = z.infer<typeof localizedSchema>

const lessonTextSchema = z
  .object({
    title: text.max(90),
    intro: text.max(400),
    body: z.array(text.max(900)).min(1).max(6),
    takeaway: text.max(300),
  })
  .strict()

const choiceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('choice'),
    prompt: localizedSchema,
    options: z.array(localizedSchema).min(2).max(4),
    /** Index into `options`. */
    answer: z.number().int().min(0),
    explanation: localizedSchema,
  })
  .strict()
  .refine((exercise) => exercise.answer < exercise.options.length, {
    message: 'answer points past the last option',
    path: ['answer'],
  })

const trueFalseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('truefalse'),
    prompt: localizedSchema,
    answer: z.boolean(),
    explanation: localizedSchema,
  })
  .strict()

const orderSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('order'),
    prompt: localizedSchema,
    /** Listed in the correct order. The player shuffles them. */
    items: z.array(localizedSchema).min(3).max(5),
    explanation: localizedSchema,
  })
  .strict()

/** Pair each left item with its right item. Shown as memory cards to children. */
const matchSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('match'),
    prompt: localizedSchema,
    pairs: z
      .array(z.object({ left: localizedSchema, right: localizedSchema }).strict())
      .min(3)
      .max(6),
    explanation: localizedSchema,
  })
  .strict()

/**
 * Build a word from shuffled letter tiles. The word is the Latin
 * transliteration of an Arabic term (SABR, WUDU), the same in every language;
 * the meaning is shown as the clue.
 */
const wordBuildSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('wordbuild'),
    prompt: localizedSchema,
    word: z.string().regex(/^[A-Z]{3,10}$/),
    meaning: localizedSchema,
    explanation: localizedSchema,
  })
  .strict()

/** A timed round of true/false statements. Passed at 80% right. */
const quickfireSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.literal('quickfire'),
    prompt: localizedSchema,
    seconds: z.number().int().min(20).max(120),
    items: z
      .array(z.object({ statement: localizedSchema, answer: z.boolean() }).strict())
      .min(4)
      .max(10),
    explanation: localizedSchema,
  })
  .strict()

export const exerciseSchema = z.discriminatedUnion('type', [
  choiceSchema,
  trueFalseSchema,
  orderSchema,
  matchSchema,
  wordBuildSchema,
  quickfireSchema,
])
export type Exercise = z.infer<typeof exerciseSchema>

export const REVIEW_STATUSES = ['draft', 'reviewed'] as const

export const lessonSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    theme: z.enum(LESSON_THEMES),
    audience: z.enum(AUDIENCES),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Position within the theme, from 1. */
    order: z.number().int().min(1).max(999),
    minutes: z.number().int().min(1).max(10),
    /**
     * Who checked the religious content, and when. A lesson only counts as
     * reviewed with a named reviewer — clearing the status by editing one word
     * is not possible (see `isReviewed`).
     */
    review: z
      .object({
        status: z.enum(REVIEW_STATUSES),
        reviewedBy: z.string().trim().max(120),
        reviewedAt: z.string().trim().max(10),
      })
      .strict(),
    /** The verse or hadith the lesson is built on, shown in Arabic. */
    key: z
      .object({
        arabic: text.max(400),
        reference: text.max(120),
      })
      .strict()
      .optional(),
    /** Every claim in the lesson must be traceable to one of these. */
    sources: z
      .array(
        z
          .object({
            kind: z.enum(['quran', 'hadith', 'scholar']),
            reference: text.max(160),
          })
          .strict(),
      )
      .min(1),
    text: z.object({ nl: lessonTextSchema, fr: lessonTextSchema, en: lessonTextSchema }).strict(),
    exercises: z.array(exerciseSchema).min(2).max(6),
  })
  .strict()
  .refine(
    (lesson) => new Set(lesson.exercises.map((exercise) => exercise.id)).size === lesson.exercises.length,
    { message: 'exercise ids must be unique within a lesson', path: ['exercises'] },
  )

export type Lesson = z.infer<typeof lessonSchema>

/** A short placement quiz per audience: five questions, graded on the server. */
export const placementSchema = z
  .object({
    audience: z.enum(AUDIENCES),
    questions: z.array(choiceSchema).length(5),
  })
  .strict()
  .refine(
    (quiz) => new Set(quiz.questions.map((question) => question.id)).size === quiz.questions.length,
    { message: 'question ids must be unique', path: ['questions'] },
  )
export type Placement = z.infer<typeof placementSchema>
export type ChoiceExercise = z.infer<typeof choiceSchema>
export type LessonText = Lesson['text']['en']

/** A lesson counts as reviewed only with a named reviewer. */
export function isReviewed(lesson: Pick<Lesson, 'review'>): boolean {
  return lesson.review.status === 'reviewed' && lesson.review.reviewedBy.trim().length > 0
}

/** The language a lesson is shown in for a member's locale. */
export function lessonLocaleFor(locale: string): LessonLocale {
  const base = locale.toLowerCase().split('-')[0] ?? 'en'
  return (LESSON_LOCALES as readonly string[]).includes(base) ? (base as LessonLocale) : 'en'
}

export function pick(value: Localized, locale: LessonLocale): string {
  return value[locale]
}
