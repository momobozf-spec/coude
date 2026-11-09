import { z } from 'zod'

import type { Exercise, Lesson } from '@/lib/learn/lesson-schema'

/**
 * Grading happens on the server, against the lesson file.
 *
 * The player also knows the answers — it has to, to explain them right after a
 * member answers — but what it reports is never trusted for XP. The server
 * re-grades the raw answers.
 */

export const answerValueSchema = z.union([
  z.number().int().min(0).max(10),
  z.boolean(),
  // Index lists (order, match, wordbuild) and true/false lists (quickfire).
  z.array(z.union([z.number().int().min(0).max(12), z.boolean()])).max(12),
])
export type AnswerValue = z.infer<typeof answerValueSchema>

export const answersSchema = z
  .record(z.string().max(40), answerValueSchema)
  .refine((answers) => Object.keys(answers).length <= 10, 'Too many answers.')
export type Answers = z.infer<typeof answersSchema>

/** Share of a quick-fire round that must be right to pass it. */
export const QUICKFIRE_PASS_RATIO = 0.8

function isIdentity(answer: AnswerValue, length: number): boolean {
  return (
    Array.isArray(answer) &&
    answer.length === length &&
    answer.every((index, position) => index === position)
  )
}

/** Letters of a word, built from the tile indices the member tapped. */
export function wordFromTiles(word: string, tiles: readonly unknown[]): string | null {
  if (tiles.length !== word.length) return null
  const used = new Set<number>()
  let built = ''
  for (const tile of tiles) {
    if (typeof tile !== 'number' || !Number.isInteger(tile) || tile < 0 || tile >= word.length) return null
    if (used.has(tile)) return null
    used.add(tile)
    built += word[tile]
  }
  return built
}

/** How many statements of a quick-fire round were answered right. */
export function quickfireScore(
  items: readonly { answer: boolean }[],
  answers: readonly unknown[],
): number {
  return items.reduce((right, item, index) => right + (answers[index] === item.answer ? 1 : 0), 0)
}

/** Is this answer correct for this exercise? Wrong types are simply wrong. */
export function isCorrect(exercise: Exercise, answer: AnswerValue | undefined): boolean {
  if (answer === undefined) return false

  switch (exercise.type) {
    case 'choice':
      return typeof answer === 'number' && answer === exercise.answer
    case 'truefalse':
      return typeof answer === 'boolean' && answer === exercise.answer
    case 'order':
      // The member reports item indices in the order they put them; the file
      // lists items in the correct order, so the answer must be 0, 1, 2, …
      return isIdentity(answer, exercise.items.length)
    case 'match':
      // answer[i] is the right-hand item paired with left item i; the file
      // lists pairs together, so the answer must again be 0, 1, 2, …
      return isIdentity(answer, exercise.pairs.length)
    case 'wordbuild':
      // Judged by the word it spells, not the tile indices: in SALAH either A
      // may come first.
      return Array.isArray(answer) && wordFromTiles(exercise.word, answer) === exercise.word
    case 'quickfire': {
      if (!Array.isArray(answer)) return false
      const needed = Math.ceil(exercise.items.length * QUICKFIRE_PASS_RATIO)
      return quickfireScore(exercise.items, answer) >= needed
    }
  }
}

export interface GradeResult {
  correct: number
  total: number
  /** Per exercise id, whether it was answered correctly. */
  results: Record<string, boolean>
  /** Exercise ids answered wrongly, in lesson order. */
  missed: string[]
}

export function gradeLesson(lesson: Pick<Lesson, 'exercises'>, answers: Answers): GradeResult {
  const results: Record<string, boolean> = {}
  const missed: string[] = []
  let correct = 0

  for (const exercise of lesson.exercises) {
    const ok = isCorrect(exercise, answers[exercise.id])
    results[exercise.id] = ok
    if (ok) correct += 1
    else missed.push(exercise.id)
  }

  return { correct, total: lesson.exercises.length, results, missed }
}

/** XP for finishing a lesson for the first time. Replays earn nothing. */
export const XP_PER_LESSON = 10
export const XP_PER_CORRECT = 2

export function xpFor(correct: number, firstTime: boolean): number {
  return firstTime ? XP_PER_LESSON + XP_PER_CORRECT * correct : 0
}

/** Level thresholds. Level 1 starts at 0 XP. */
export const LEVELS = [0, 50, 120, 220, 350, 520, 750, 1050, 1450, 2000] as const

export interface LevelInfo {
  level: number
  /** 0–1 progress towards the next level; 1 at the top level. */
  progress: number
  xpIntoLevel: number
  xpForNext: number | null
}

export function levelFor(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp))
  let level = 1
  for (let index = 0; index < LEVELS.length; index += 1) {
    if (safe >= LEVELS[index]!) level = index + 1
  }

  const floor = LEVELS[level - 1] ?? 0
  const next = LEVELS[level]
  if (next === undefined) {
    return { level, progress: 1, xpIntoLevel: safe - floor, xpForNext: null }
  }

  return {
    level,
    progress: (safe - floor) / (next - floor),
    xpIntoLevel: safe - floor,
    xpForNext: next - floor,
  }
}

/**
 * Starting level from the placement quiz (five questions).
 * 0–2 right → starter, 3–4 → advanced, 5 → deepening.
 */
export function placementLevel(correct: number): 1 | 2 | 3 {
  if (correct >= 5) return 3
  if (correct >= 3) return 2
  return 1
}

/**
 * A learner moves up once every lesson of their current level is finished.
 * A level with no lessons yet never blocks: there is simply nothing above it.
 */
export function levelAfter(
  current: number,
  lessonsAtCurrentLevel: readonly string[],
  completed: ReadonlySet<string>,
  highestLevelWithLessons: number,
): number {
  if (current >= 3 || current >= highestLevelWithLessons) return current
  if (lessonsAtCurrentLevel.length === 0) return current
  return lessonsAtCurrentLevel.every((slug) => completed.has(slug)) ? current + 1 : current
}
