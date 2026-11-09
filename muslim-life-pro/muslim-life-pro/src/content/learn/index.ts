import {
  AUDIENCES,
  lessonSchema,
  placementSchema,
  type Audience,
  type Lesson,
  type Placement,
} from '@/lib/learn/lesson-schema'

import allahMadeEverything from './allah-made-everything.json'
import asrAtBanuQurayza from './asr-at-banu-qurayza.json'
import createdFromNothing from './created-from-nothing.json'
import doNotGrieve from './do-not-grieve.json'
import fivePillars from './five-pillars.json'
import ibrahimAndTheIdols from './ibrahim-and-the-idols.json'
import nuhAndTheArk from './nuh-and-the-ark.json'
import placementAdults from './placement-adults.json'
import placementKids from './placement-kids.json'
import placementTeens from './placement-teens.json'
import rumoursOnline from './rumours-online.json'
import worryAndAnxiety from './worry-and-anxiety.json'
import wuduStepByStep from './wudu-step-by-step.json'
import yusufForgives from './yusuf-forgives.json'

/**
 * Every lesson in the learning path, for every age group.
 *
 * Adding a lesson: write the JSON file (see docs/learn.md), import it here and
 * add it to the list. Files are validated when this module loads, so a typo
 * fails the build and the test suite instead of a member's lesson.
 */
const RAW_LESSONS: unknown[] = [
  // Adults
  createdFromNothing,
  ibrahimAndTheIdols,
  doNotGrieve,
  worryAndAnxiety,
  asrAtBanuQurayza,
  // Children (6–9)
  allahMadeEverything,
  nuhAndTheArk,
  wuduStepByStep,
  // Teens (10–15)
  fivePillars,
  yusufForgives,
  rumoursOnline,
]

const RAW_PLACEMENTS: unknown[] = [placementKids, placementTeens, placementAdults]

function slugOf(entry: unknown, index: number): string {
  return typeof entry === 'object' && entry !== null && 'slug' in entry
    ? String((entry as { slug: unknown }).slug)
    : `#${index}`
}

function load(raw: readonly unknown[]): Lesson[] {
  const lessons = raw.map((entry, index) => {
    const parsed = lessonSchema.safeParse(entry)
    if (!parsed.success) {
      throw new Error(`Invalid lesson ${slugOf(entry, index)}: ${parsed.error.message}`)
    }
    return parsed.data
  })

  const slugs = new Set<string>()
  const positions = new Set<string>()
  for (const lesson of lessons) {
    if (slugs.has(lesson.slug)) throw new Error(`Duplicate lesson slug: ${lesson.slug}`)
    slugs.add(lesson.slug)

    const position = `${lesson.theme}:${lesson.order}`
    if (positions.has(position)) throw new Error(`Two lessons share position ${position}`)
    positions.add(position)
  }

  return lessons
}

function loadPlacements(raw: readonly unknown[]): Record<Audience, Placement> {
  const byAudience = new Map<Audience, Placement>()
  for (const entry of raw) {
    const parsed = placementSchema.safeParse(entry)
    if (!parsed.success) throw new Error(`Invalid placement quiz: ${parsed.error.message}`)
    if (byAudience.has(parsed.data.audience)) {
      throw new Error(`Two placement quizzes for ${parsed.data.audience}`)
    }
    byAudience.set(parsed.data.audience, parsed.data)
  }
  for (const audience of AUDIENCES) {
    if (!byAudience.has(audience)) throw new Error(`Missing placement quiz for ${audience}`)
  }
  return Object.fromEntries(byAudience) as Record<Audience, Placement>
}

export const LESSONS: readonly Lesson[] = load(RAW_LESSONS)
export const PLACEMENTS: Readonly<Record<Audience, Placement>> = loadPlacements(RAW_PLACEMENTS)
