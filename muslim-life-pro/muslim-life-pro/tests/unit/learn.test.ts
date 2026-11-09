import { describe, expect, it } from 'vitest'

import { LESSONS, PLACEMENTS } from '@/content/learn'
import {
  gradeLesson,
  isCorrect,
  levelAfter,
  levelFor,
  LEVELS,
  placementLevel,
  QUICKFIRE_PASS_RATIO,
  wordFromTiles,
  xpFor,
  XP_PER_CORRECT,
  XP_PER_LESSON,
} from '@/lib/learn/grading'
import {
  AUDIENCES,
  LESSON_LOCALES,
  LESSON_THEMES,
  isReviewed,
  lessonLocaleFor,
  lessonSchema,
  type Exercise,
  type Lesson,
} from '@/lib/learn/lesson-schema'
import { computeRhythm, RHYTHM_MAX_GAP_DAYS } from '@/lib/learn/rhythm'
import { isAnswerCorrect } from '@/modules/learn/games'
import { shuffledIndices } from '@/modules/learn/shuffle'
import { localizeExercise, showDrafts, toLessonView, visibleLessons } from '@/server/modules/learn/learn.service'
import { PLAN_FEATURES, PLAN_LIMITS } from '@/config/plans'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function perfectAnswer(exercise: Exercise) {
  switch (exercise.type) {
    case 'choice':
    case 'truefalse':
      return exercise.answer
    case 'order':
      return exercise.items.map((_, index) => index)
    case 'match':
      return exercise.pairs.map((_, index) => index)
    case 'wordbuild':
      return exercise.word.split('').map((_, index) => index)
    case 'quickfire':
      return exercise.items.map((item) => item.answer)
  }
}

function perfectAnswers(target: Lesson) {
  return Object.fromEntries(target.exercises.map((exercise) => [exercise.id, perfectAnswer(exercise)]))
}

const allExercises = LESSONS.flatMap((lesson) => lesson.exercises.map((exercise) => [lesson, exercise] as const))

const sample = LESSONS[0]!

describe('lesson content', () => {
  it('ships at least one lesson', () => {
    expect(LESSONS.length).toBeGreaterThan(0)
  })

  it.each(LESSONS.map((lesson) => [lesson.slug, lesson] as const))(
    '%s validates against the schema',
    (_slug, lesson) => {
      expect(lessonSchema.safeParse(lesson).success).toBe(true)
    },
  )

  it('cites at least one source in every lesson', () => {
    for (const lesson of LESSONS) {
      expect(lesson.sources.length, lesson.slug).toBeGreaterThan(0)
    }
  })

  it('has every piece of text in every lesson language', () => {
    for (const lesson of LESSONS) {
      for (const locale of LESSON_LOCALES) {
        const text = lesson.text[locale]
        expect(text.title.length, `${lesson.slug} ${locale}`).toBeGreaterThan(0)
        expect(text.body.length, `${lesson.slug} ${locale}`).toBe(lesson.text.en.body.length)
      }
    }
  })

  it('keeps the correct order of an ordering exercise unambiguous (distinct items)', () => {
    for (const lesson of LESSONS) {
      for (const exercise of lesson.exercises) {
        if (exercise.type !== 'order') continue
        for (const locale of LESSON_LOCALES) {
          const items = exercise.items.map((item) => item[locale])
          expect(new Set(items).size, `${lesson.slug}/${exercise.id} ${locale}`).toBe(items.length)
        }
      }
    }
  })

  it('gives every age group lessons from the first level, and a five-question level test', () => {
    for (const audience of AUDIENCES) {
      const lessons = LESSONS.filter((lesson) => lesson.audience === audience)
      expect(lessons.some((lesson) => lesson.level === 1), audience).toBe(true)
      expect(PLACEMENTS[audience].questions, audience).toHaveLength(5)
    }
  })

  it('has at least one game beyond plain questions for children and teens', () => {
    for (const audience of ['kids', 'teens'] as const) {
      const types = new Set(
        LESSONS.filter((lesson) => lesson.audience === audience).flatMap((lesson) =>
          lesson.exercises.map((exercise) => exercise.type),
        ),
      )
      for (const game of ['match', 'wordbuild', 'quickfire'] as const) {
        if (audience === 'kids' && game === 'quickfire') continue
        expect(types.has(game), `${audience} ${game}`).toBe(true)
      }
    }
  })

  it('keeps match pairs unambiguous (distinct on both sides, in every language)', () => {
    for (const [lesson, exercise] of allExercises) {
      if (exercise.type !== 'match') continue
      for (const locale of LESSON_LOCALES) {
        const left = exercise.pairs.map((pair) => pair.left[locale])
        const right = exercise.pairs.map((pair) => pair.right[locale])
        expect(new Set(left).size, `${lesson.slug}/${exercise.id} ${locale}`).toBe(left.length)
        expect(new Set(right).size, `${lesson.slug}/${exercise.id} ${locale}`).toBe(right.length)
      }
    }
  })

  it('makes a quick-fire round winnable in time and not all one answer', () => {
    for (const [lesson, exercise] of allExercises) {
      if (exercise.type !== 'quickfire') continue
      expect(exercise.seconds / exercise.items.length, `${lesson.slug}/${exercise.id}`).toBeGreaterThanOrEqual(5)
      const trues = exercise.items.filter((item) => item.answer).length
      expect(trues, `${lesson.slug}/${exercise.id}`).toBeGreaterThan(0)
      expect(trues, `${lesson.slug}/${exercise.id}`).toBeLessThan(exercise.items.length)
    }
  })

  it('does not claim a review that names no reviewer', () => {
    for (const lesson of LESSONS) {
      if (lesson.review.status === 'reviewed') {
        expect(lesson.review.reviewedBy.trim().length, lesson.slug).toBeGreaterThan(0)
      }
    }
  })

  it('ships today’s lessons as drafts — nobody has reviewed them yet', () => {
    // When a scholar signs a lesson off, this test is updated deliberately.
    for (const lesson of LESSONS) {
      expect(isReviewed(lesson), lesson.slug).toBe(false)
    }
  })
})

describe('lesson schema', () => {
  it('rejects a choice answer that points past the options', () => {
    const broken = clone(sample) as Lesson
    const choice = broken.exercises.find((exercise) => exercise.type === 'choice')
    expect(choice).toBeDefined()
    if (choice?.type === 'choice') choice.answer = choice.options.length
    expect(lessonSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a lesson missing a language', () => {
    const broken = clone(sample) as unknown as { text: Record<string, unknown> }
    delete broken.text.fr
    expect(lessonSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects duplicate exercise ids', () => {
    const broken = clone(sample) as Lesson
    broken.exercises[1]!.id = broken.exercises[0]!.id
    expect(lessonSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a word that is not plain capital letters', () => {
    const broken = clone(sample) as Lesson
    broken.exercises[0] = {
      id: 'word',
      type: 'wordbuild',
      word: 'Salah',
      prompt: broken.exercises[0]!.prompt,
      meaning: broken.exercises[0]!.prompt,
      explanation: broken.exercises[0]!.explanation,
    } as Exercise
    expect(lessonSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a lesson without an audience or level', () => {
    const broken = clone(sample) as unknown as Record<string, unknown>
    delete broken.audience
    expect(lessonSchema.safeParse(broken).success).toBe(false)
    const noLevel = clone(sample) as unknown as Record<string, unknown>
    noLevel.level = 4
    expect(lessonSchema.safeParse(noLevel).success).toBe(false)
  })

  it('rejects a lesson without sources', () => {
    const broken = clone(sample) as Lesson
    broken.sources = []
    expect(lessonSchema.safeParse(broken).success).toBe(false)
  })

  it('treats "reviewed" without a named reviewer as a draft', () => {
    expect(isReviewed({ review: { status: 'reviewed', reviewedBy: '  ', reviewedAt: '' } })).toBe(false)
    expect(isReviewed({ review: { status: 'reviewed', reviewedBy: 'Imam X', reviewedAt: '2026-11-01' } })).toBe(true)
    expect(isReviewed({ review: { status: 'draft', reviewedBy: 'Imam X', reviewedAt: '' } })).toBe(false)
  })

  it('serves English to locales without lesson text', () => {
    expect(lessonLocaleFor('nl')).toBe('nl')
    expect(lessonLocaleFor('fr-BE')).toBe('fr')
    expect(lessonLocaleFor('ar')).toBe('en')
    expect(lessonLocaleFor('en')).toBe('en')
  })
})

describe('draft visibility', () => {
  const reviewed = { ...clone(sample), slug: 'reviewed-one', review: { status: 'reviewed' as const, reviewedBy: 'Imam X', reviewedAt: '2026-11-01' } }
  const draft = clone(sample)

  it('hides drafts when drafts are off', () => {
    expect(visibleLessons([draft, reviewed], false).map((lesson) => lesson.slug)).toEqual(['reviewed-one'])
  })

  it('shows drafts when drafts are on', () => {
    expect(visibleLessons([draft, reviewed], true)).toHaveLength(2)
  })

  it('shows drafts outside production, and in production only when opted in', () => {
    expect(showDrafts({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true)
    expect(showDrafts({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false)
    expect(showDrafts({ NODE_ENV: 'production', LEARN_SHOW_DRAFTS: '1' } as NodeJS.ProcessEnv)).toBe(true)
    expect(showDrafts({ NODE_ENV: 'production', LEARN_SHOW_DRAFTS: 'true' } as NodeJS.ProcessEnv)).toBe(false)
  })

  it('orders lessons by level, then theme, then position', () => {
    const themeIndex = (theme: string) => (LESSON_THEMES as readonly string[]).indexOf(theme)
    for (const audience of AUDIENCES) {
      const ordered = visibleLessons(LESSONS, true, audience)
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1]!
        const current = ordered[index]!
        const rank =
          previous.level - current.level ||
          themeIndex(previous.theme) - themeIndex(current.theme) ||
          previous.order - current.order
        expect(rank).toBeLessThan(0)
      }
    }
  })

  it('filters lessons by age group', () => {
    for (const audience of AUDIENCES) {
      const lessons = visibleLessons(LESSONS, true, audience)
      expect(lessons.length).toBeGreaterThan(0)
      expect(lessons.every((lesson) => lesson.audience === audience)).toBe(true)
    }
    expect(visibleLessons(LESSONS, true)).toHaveLength(LESSONS.length)
  })

  it('localizes a lesson view without losing exercises', () => {
    const view = toLessonView(sample, 'fr')
    expect(view.title).toBe(sample.text.fr.title)
    expect(view.exercises).toHaveLength(sample.exercises.length)
    expect(view.isDraft).toBe(true)
  })
})

describe('grading', () => {
  const lesson = LESSONS.find((entry) => entry.exercises.some((exercise) => exercise.type === 'order'))!

  it.each(LESSONS.map((entry) => [entry.slug, entry] as const))('%s: perfect answers score full marks', (_slug, entry) => {
    const result = gradeLesson(entry, perfectAnswers(entry))
    expect(result.correct).toBe(entry.exercises.length)
    expect(result.missed).toEqual([])
  })

  it('scores missing answers as wrong and lists them as missed', () => {
    const result = gradeLesson(lesson, {})
    expect(result.correct).toBe(0)
    expect(result.missed).toEqual(lesson.exercises.map((exercise) => exercise.id))
  })

  it('rejects answers of the wrong type', () => {
    const answers = Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, 'yes' as never]))
    expect(gradeLesson(lesson, answers).correct).toBe(0)
  })

  it('rejects an ordering with the right items in the wrong order', () => {
    const order = lesson.exercises.find((exercise) => exercise.type === 'order')!
    if (order.type !== 'order') throw new Error('unreachable')
    const reversed = order.items.map((_, index) => index).reverse()
    expect(gradeLesson(lesson, { [order.id]: reversed }).results[order.id]).toBe(false)
  })

  it('rejects an ordering that is too short', () => {
    const order = lesson.exercises.find((exercise) => exercise.type === 'order')!
    expect(gradeLesson(lesson, { [order.id]: [0, 1] }).results[order.id]).toBe(false)
  })

  it('accepts only the right pairing in a match', () => {
    const match = allExercises.find(([, exercise]) => exercise.type === 'match')![1]
    if (match.type !== 'match') throw new Error('unreachable')
    const swapped = match.pairs.map((_, index) => index)
    ;[swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!]
    expect(isCorrect(match, swapped)).toBe(false)
    expect(isCorrect(match, swapped.slice(1))).toBe(false)
  })

  it('judges a word by what it spells, so repeated letters can come in either order', () => {
    const word = {
      id: 'w',
      type: 'wordbuild' as const,
      word: 'ZAKAT',
      prompt: sample.text.en.title as never,
      meaning: sample.text.en.title as never,
      explanation: sample.text.en.title as never,
    }
    expect(isCorrect(word, [0, 1, 2, 3, 4])).toBe(true)
    // The two As (1 and 3) swapped still spell ZAKAT.
    expect(isCorrect(word, [0, 3, 2, 1, 4])).toBe(true)
    expect(isCorrect(word, [0, 2, 1, 3, 4])).toBe(false)
    // A tile cannot be used twice, and indices must exist.
    expect(isCorrect(word, [0, 1, 2, 1, 4])).toBe(false)
    expect(isCorrect(word, [0, 1, 2, 3, 9])).toBe(false)
    expect(wordFromTiles('SALAH', [0, 3, 2, 1, 4])).toBe('SALAH')
    expect(wordFromTiles('SALAH', [0, 1])).toBeNull()
  })

  it('passes a quick-fire round from 80% right', () => {
    const items = [true, false, true, false, true].map((answer) => ({ statement: sample.text.en.title as never, answer }))
    const round = { id: 'q', type: 'quickfire' as const, seconds: 30, prompt: sample.text.en.title as never, explanation: sample.text.en.title as never, items }
    const right = items.map((item) => item.answer)
    expect(QUICKFIRE_PASS_RATIO).toBe(0.8)
    expect(isCorrect(round, right)).toBe(true)
    expect(isCorrect(round, [...right.slice(0, 4), !right[4]])).toBe(true)
    expect(isCorrect(round, [!right[0], !right[1], ...right.slice(2)])).toBe(false)
    // Running out of time: what was answered counts, the rest is wrong.
    expect(isCorrect(round, right.slice(0, 4))).toBe(true)
    expect(isCorrect(round, right.slice(0, 3))).toBe(false)
    expect(isCorrect(round, [])).toBe(false)
  })

  it('gives the player the same verdict as the server', () => {
    for (const [, exercise] of allExercises) {
      const view = localizeExercise(exercise, 'nl')
      const answer = perfectAnswer(exercise)
      expect(isAnswerCorrect(view, answer), exercise.id).toBe(isCorrect(exercise, answer))
      expect(isAnswerCorrect(view, undefined), exercise.id).toBe(false)
    }
  })
})

describe('placement and levels', () => {
  it('maps the level test to a starting level', () => {
    expect([0, 1, 2, 3, 4, 5].map(placementLevel)).toEqual([1, 1, 1, 2, 2, 3])
  })

  it('moves up only when every lesson of the level is done', () => {
    expect(levelAfter(1, ['a', 'b'], new Set(['a']), 3)).toBe(1)
    expect(levelAfter(1, ['a', 'b'], new Set(['a', 'b']), 3)).toBe(2)
  })

  it('does not move past the last level with lessons, or past level 3', () => {
    expect(levelAfter(2, ['c'], new Set(['c']), 2)).toBe(2)
    expect(levelAfter(3, ['d'], new Set(['d']), 3)).toBe(3)
    expect(levelAfter(1, [], new Set(), 3)).toBe(1)
  })

  it('keeps placement answers inside the options', () => {
    for (const audience of AUDIENCES) {
      for (const question of PLACEMENTS[audience].questions) {
        expect(question.answer).toBeLessThan(question.options.length)
      }
    }
  })
})

describe('xp and levels', () => {
  it('awards XP only the first time', () => {
    expect(xpFor(3, true)).toBe(XP_PER_LESSON + 3 * XP_PER_CORRECT)
    expect(xpFor(3, false)).toBe(0)
    expect(xpFor(0, true)).toBe(XP_PER_LESSON)
  })

  it('starts at level 1 and climbs at each threshold', () => {
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(LEVELS[1]! - 1).level).toBe(1)
    expect(levelFor(LEVELS[1]!).level).toBe(2)
    expect(levelFor(-10).level).toBe(1)
  })

  it('reports progress within a level', () => {
    const halfway = (LEVELS[1]! - LEVELS[0]!) / 2
    expect(levelFor(halfway).progress).toBeCloseTo(0.5)
  })

  it('tops out at the last level', () => {
    const top = levelFor(LEVELS[LEVELS.length - 1]! + 500)
    expect(top.level).toBe(LEVELS.length)
    expect(top.progress).toBe(1)
    expect(top.xpForNext).toBeNull()
  })
})

describe('learning rhythm', () => {
  const today = '2026-10-26'

  it('is empty with no learning', () => {
    expect(computeRhythm([], today)).toMatchObject({ current: 0, best: 0, lastDate: null, daysLeft: null })
  })

  it('holds across gaps of up to three days', () => {
    // 19 → 22 (3 days) → 25 (3 days)
    const rhythm = computeRhythm(['2026-10-19', '2026-10-22', '2026-10-25'], today)
    expect(rhythm.current).toBe(3)
    expect(rhythm.daysLeft).toBe(RHYTHM_MAX_GAP_DAYS - 1)
    expect(rhythm.learnedToday).toBe(false)
  })

  it('breaks on a gap of four days', () => {
    const rhythm = computeRhythm(['2026-10-15', '2026-10-19', '2026-10-25'], today)
    expect(rhythm.current).toBe(1)
    expect(rhythm.best).toBe(1)
  })

  it('lapses when the last learning day is too long ago, but keeps the best run', () => {
    const rhythm = computeRhythm(['2026-10-10', '2026-10-11', '2026-10-12'], today)
    expect(rhythm.current).toBe(0)
    expect(rhythm.best).toBe(3)
    expect(rhythm.daysLeft).toBeNull()
  })

  it('counts a day once, however many lessons were finished', () => {
    const rhythm = computeRhythm([today, today, today], today)
    expect(rhythm.current).toBe(1)
    expect(rhythm.learnedToday).toBe(true)
    expect(rhythm.daysLeft).toBe(RHYTHM_MAX_GAP_DAYS)
  })

  it('says "learn today" on the last day of the window', () => {
    expect(computeRhythm(['2026-10-23'], today).daysLeft).toBe(0)
  })

  it('ignores dates in the future', () => {
    expect(computeRhythm(['2026-10-30'], today).current).toBe(0)
  })
})

describe('shuffle', () => {
  it('returns a permutation', () => {
    for (const length of [2, 3, 4, 5]) {
      expect(shuffledIndices(length, 'seed').slice().sort()).toEqual(
        Array.from({ length }, (_, index) => index),
      )
    }
  })

  it('is deterministic for a seed, so server and browser agree', () => {
    expect(shuffledIndices(5, 'lesson:q1')).toEqual(shuffledIndices(5, 'lesson:q1'))
  })

  it('never returns an ordering question already solved', () => {
    for (const lesson of LESSONS) {
      for (const exercise of lesson.exercises) {
        const length =
          exercise.type === 'order'
            ? exercise.items.length
            : exercise.type === 'choice'
              ? exercise.options.length
              : exercise.type === 'wordbuild'
                ? exercise.word.length
                : exercise.type === 'match'
                  ? exercise.pairs.length
                  : 0
        if (length < 2) continue
        const order = shuffledIndices(length, `${lesson.slug}:${exercise.id}`)
        expect(order.every((value, position) => value === position), `${lesson.slug}:${exercise.id}`).toBe(false)
      }
    }
  })
})

describe('word builder tiles', () => {
  it('never shows the word already spelled out', () => {
    for (const [lesson, exercise] of allExercises) {
      if (exercise.type !== 'wordbuild') continue
      const tiles = shuffledIndices(exercise.word.length, `${lesson.slug}:${exercise.id}`)
      expect(tiles.map((tile) => exercise.word[tile]).join(''), `${lesson.slug}:${exercise.id}`).not.toBe(exercise.word)
    }
  })
})

describe('plan', () => {
  it('limits new lessons on Free and not on Premium', () => {
    expect(PLAN_LIMITS.FREE.newLessonsPerDay).toBe(2)
    expect(PLAN_LIMITS.PREMIUM.newLessonsPerDay).toBeNull()
  })

  it('sells the lesson limit the server enforces', () => {
    expect(PLAN_FEATURES.find((feature) => feature.key === 'lessons')).toEqual({
      key: 'lessons',
      free: '2perDay',
      premium: 'unlimited',
    })
  })
})
