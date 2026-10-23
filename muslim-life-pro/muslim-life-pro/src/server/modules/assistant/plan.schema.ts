import { z } from 'zod'

/**
 * Generated plan schemas.
 *
 * The contract provider output must satisfy. Nothing is ever `JSON.parse`d and
 * trusted — every generator validates against one of these, and a failure is an
 * `AI_OUTPUT_INVALID` error rather than a half-formed plan reaching the planner.
 *
 * Note that items use `dayOffset` (days from today) rather than absolute dates.
 * Models are unreliable at date arithmetic, and a wrong absolute date silently
 * schedules something into last week. The offset is resolved server-side against
 * the member's own local day.
 */

/** Bump when the shape changes, so old plans stay readable. */
export const GENERATOR_VERSION = 1

export const planItemKindSchema = z.enum(['TASK', 'BLOCK', 'HABIT_SUGGESTION', 'NOTE'])

export const planCategorySchema = z.enum([
  'PERSONAL',
  'WORK',
  'FAMILY',
  'HEALTH',
  'LEARNING',
  'ERRAND',
  'WORSHIP',
  'OTHER',
])

export const blockTypeSchema = z.enum(['FOCUS', 'TASK', 'APPOINTMENT', 'PERSONAL', 'CUSTOM'])

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Expected HH:mm')

export const generatedItemSchema = z
  .object({
    kind: planItemKindSchema.default('TASK'),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),

    /** Days from the member's today. 0 = today. Capped at eight weeks out. */
    dayOffset: z.number().int().min(0).max(56).optional(),

    /** For TASK items. */
    preferredTime: clockTime.optional(),
    estimatedMinutes: z.number().int().min(5).max(600).optional(),
    category: planCategorySchema.optional(),

    /** For BLOCK items. */
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
    blockType: blockTypeSchema.optional(),
  })
  .refine(
    (item) => item.kind !== 'BLOCK' || (item.startTime !== undefined && item.endTime !== undefined),
    { message: 'A block needs a start and an end time.', path: ['startTime'] },
  )
  .refine(
    (item) =>
      item.kind !== 'BLOCK' ||
      item.startTime === undefined ||
      item.endTime === undefined ||
      item.endTime > item.startTime,
    { message: 'A block must end after it starts.', path: ['endTime'] },
  )

export type GeneratedItem = z.infer<typeof generatedItemSchema>

export const generatedPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(600).default(''),
  items: z.array(generatedItemSchema).min(1).max(40),
})

export type GeneratedPlanPayload = z.infer<typeof generatedPlanSchema>

/** Per-generator aliases, so the tool name the provider sees is meaningful. */
export const weeklyPlanSchema = generatedPlanSchema
export const ramadanPlanSchema = generatedPlanSchema
export const travelPlanSchema = generatedPlanSchema
export const lifeEventPlanSchema = generatedPlanSchema

export const conversationTitleSchema = z.object({
  title: z.string().trim().min(1).max(60),
})

// ─── Generator inputs ────────────────────────────────────────────────────────

export const GENERATOR_TYPES = ['WEEKLY', 'RAMADAN', 'TRAVEL', 'LIFE_EVENT', 'CUSTOM'] as const
export type GeneratorTypeValue = (typeof GENERATOR_TYPES)[number]

export const generateWeeklySchema = z.object({
  type: z.literal('WEEKLY'),
  /** Free text from the member — fenced as untrusted before it reaches a prompt. */
  focus: z.string().trim().max(500).optional(),
})

export const generateRamadanSchema = z.object({
  type: z.literal('RAMADAN'),
  workHours: z.string().trim().max(120).optional(),
  sleepPreference: z.string().trim().max(120).optional(),
  /** The member's own worship goals. Never invented by the assistant. */
  worshipGoals: z.string().trim().max(500).optional(),
  familyCommitments: z.string().trim().max(500).optional(),
})

export const generateTravelSchema = z.object({
  type: z.literal('TRAVEL'),
  destination: z.string().trim().min(1).max(120),
  departureOffsetDays: z.number().int().min(0).max(180).optional(),
  durationDays: z.number().int().min(1).max(60).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const generateLifeEventSchema = z.object({
  type: z.literal('LIFE_EVENT'),
  event: z.string().trim().min(1).max(120),
  targetOffsetDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const generatePlanInputSchema = z.discriminatedUnion('type', [
  generateWeeklySchema,
  generateRamadanSchema,
  generateTravelSchema,
  generateLifeEventSchema,
])

export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>

// ─── Apply ───────────────────────────────────────────────────────────────────

/**
 * What the member confirmed.
 *
 * Each selection may carry edits made in the preview — a changed title, a moved
 * date, a different time. The edits are validated here exactly like generated
 * content, because by this point the origin no longer matters.
 */
export const planSelectionSchema = z.object({
  itemId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startTime: clockTime.optional(),
  endTime: clockTime.optional(),
  estimatedMinutes: z.number().int().min(5).max(600).nullable().optional(),
})

export const applyPlanSchema = z.object({
  planId: z.string().uuid(),
  selections: z.array(planSelectionSchema).min(1).max(40),
})

export type PlanSelection = z.infer<typeof planSelectionSchema>

/** Deterministic identity for an item, so applying is idempotent. */
export function buildItemKey(
  kind: string,
  title: string,
  localDate: string | null,
  startTime?: string | null,
): string {
  const normalised = title.trim().toLowerCase().replace(/\s+/g, ' ')
  return [kind, normalised, localDate ?? 'undated', startTime ?? ''].join('|')
}

/** Normalised title used for duplicate detection against the planner. */
export function normaliseTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
}
