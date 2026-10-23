import 'server-only'

import type { GeneratorType, Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { addDays, isoDateToUtcDate, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import { rangesOverlap, timeWithinRange, toMinutes, instantToClockTime } from '@/lib/planner/time'
import { getAiProvider, isAiConfigured, isLiveProvider } from '@/server/integrations/ai'
import { AiError, toAiError } from '@/server/modules/assistant/ai-errors'
import { computeForDay, getPrayerSettings } from '@/server/modules/prayer/prayer.service'
import { PRAYER_LABELS } from '@/lib/prayer/types'
import { buildAssistantContext, type AssistantContext } from '@/server/modules/assistant/context'
import { buildGeneratorSystemPrompt } from '@/server/modules/assistant/prompts'
import { fenceUntrusted } from '@/server/modules/assistant/safety'
import { commit, release, reserve } from '@/server/modules/assistant/usage.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import {
  GENERATOR_VERSION,
  buildItemKey,
  generatedPlanSchema,
  normaliseTitle,
  type GeneratePlanInput,
  type GeneratedItem,
  type GeneratedPlanPayload,
} from '@/server/modules/assistant/plan.schema'

/**
 * Plan generation.
 *
 * The model's job is to propose. Everything that must be *correct* — dates,
 * prayer conflicts, duplicates, overlaps — is computed deterministically before
 * and after the call. The model never does arithmetic that matters.
 *
 * Nothing here writes to the planner. Generation produces a `GeneratedPlan` in
 * `READY`, and only `applyGeneratedPlan` (with an explicit member selection) can
 * create a task or a block.
 */

const GENERATOR_TASKS: Record<string, string> = {
  WEEKLY:
    'Draft a realistic week for this member. Use the free windows given to you. Keep it modest — a plan with six good items that actually happen beats twenty that do not.',
  RAMADAN:
    'Draft practical arrangements for Ramadan. Build around the sleep window first. Worship targets belong to the member: propose the practical scaffolding (time set aside, preparation, meal planning), never an amount of worship they "should" do.',
  TRAVEL:
    'Draft trip preparation, split between before departure and during the trip. Include practical prayer considerations at the destination as information, never as a ruling.',
  LIFE_EVENT:
    'Draft a practical preparation checklist for this life event. Stay concrete. Anything medical, legal, financial or religious should be flagged as something to take to a qualified professional.',
  CUSTOM: 'Draft a practical plan for what the member described.',
}

const SCHEMA_NAMES: Record<string, string> = {
  WEEKLY: 'weekly_plan',
  RAMADAN: 'ramadan_plan',
  TRAVEL: 'travel_plan',
  LIFE_EVENT: 'life_event_plan',
  CUSTOM: 'weekly_plan',
}

export interface PlanItemView {
  id: string
  kind: 'TASK' | 'BLOCK' | 'HABIT_SUGGESTION' | 'NOTE'
  status: 'PROPOSED' | 'APPLIED' | 'SKIPPED' | 'DUPLICATE'
  title: string
  description: string | null
  localDate: IsoDate | null
  startTime: string | null
  endTime: string | null
  estimatedMinutes: number | null
  category: string | null
  /** Set when this collides with something already planned. */
  duplicateOfTaskId: string | null
  /** Populated by deterministic post-processing, never by the model. */
  warnings: string[]
  taskId: string | null
  blockId: string | null
}

export interface PlanView {
  id: string
  type: GeneratorType
  title: string
  summary: string
  status: 'DRAFT' | 'READY' | 'APPLIED' | 'ARCHIVED'
  items: PlanItemView[]
  createdAt: Date
  appliedAt: Date | null
  isDemoProvider: boolean
}

/**
 * Generate a plan.
 *
 * Order matters: quota is reserved before the provider is touched, so an
 * out-of-quota member never costs anything.
 */
export async function generatePlan(
  actor: Actor,
  input: GeneratePlanInput,
  options: { conversationId?: string } = {},
): Promise<PlanView> {
  // Checked before the quota is touched: a misconfigured deployment must not
  // consume someone's monthly allowance to produce an error.
  if (!isAiConfigured()) {
    throw toAiError(
      (() => {
        try {
          getAiProvider()
          return null
        } catch (error) {
          return error
        }
      })(),
    )
  }

  const reservation = await reserve(actor, 'GENERATOR')

  try {
    const context = await buildAssistantContext(actor, {
      days: input.type === 'WEEKLY' ? 7 : 21,
      includeFreeWindows: true,
    })

    const provider = getAiProvider()
    const schemaName = SCHEMA_NAMES[input.type] ?? 'weekly_plan'

    const system = buildGeneratorSystemPrompt(context, GENERATOR_TASKS[input.type] ?? '')
    const userMessage = buildGeneratorRequest(input)

    let result
    try {
      result = await provider.generateStructured({
        system,
        messages: [{ role: 'user', content: userMessage }],
        schema: generatedPlanSchema,
        schemaName,
        schemaDescription: 'A reviewable plan of proposed items.',
        maxTokens: 4096,
      })
    } catch (error) {
      // Infrastructure failure means the slot is given back. A refusal or an
      // invalid output is also released — the member got nothing usable.
      await release(reservation)
      throw toAiError(error)
    }

    await commit(reservation, result.usage)

    const plan = await persistPlan(actor, input, result.data, context, {
      conversationId: options.conversationId,
      provider: result.provider,
      model: result.model,
    })

    return plan
  } catch (error) {
    await release(reservation)
    throw error
  }
}


/** Member-supplied text is fenced — it is data describing a request, not instructions. */
function buildGeneratorRequest(input: GeneratePlanInput): string {
  switch (input.type) {
    case 'WEEKLY':
      return input.focus
        ? `Plan my week. What I want to focus on:\n${fenceUntrusted('member-input', input.focus)}`
        : 'Plan my week.'

    case 'RAMADAN':
      return [
        'Help me arrange Ramadan.',
        input.workHours ? `Working hours:\n${fenceUntrusted('member-input', input.workHours)}` : '',
        input.sleepPreference ? `Sleep:\n${fenceUntrusted('member-input', input.sleepPreference)}` : '',
        input.worshipGoals
          ? `My own worship goals (these are mine, do not change them):\n${fenceUntrusted('member-input', input.worshipGoals)}`
          : '',
        input.familyCommitments
          ? `Family commitments:\n${fenceUntrusted('member-input', input.familyCommitments)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')

    case 'TRAVEL':
      return [
        `Help me prepare for a trip to ${fenceUntrusted('destination', input.destination)}.`,
        input.departureOffsetDays !== undefined
          ? `I leave in ${input.departureOffsetDays} days.`
          : '',
        input.durationDays !== undefined ? `The trip is ${input.durationDays} days.` : '',
        input.notes ? `Notes:\n${fenceUntrusted('member-input', input.notes)}` : '',
      ]
        .filter(Boolean)
        .join('\n')

    case 'LIFE_EVENT':
      return [
        `Help me prepare for: ${fenceUntrusted('event', input.event)}.`,
        input.targetOffsetDays !== undefined ? `It is in ${input.targetOffsetDays} days.` : '',
        input.notes ? `Notes:\n${fenceUntrusted('member-input', input.notes)}` : '',
      ]
        .filter(Boolean)
        .join('\n')

    default:
      return 'Help me plan.'
  }
}

/**
 * Persist a validated payload as a plan plus its items.
 *
 * This is where deterministic post-processing happens: resolving offsets to real
 * local dates, detecting duplicates against the actual planner, and checking
 * prayer and block conflicts using the same services the planner itself uses.
 */
async function persistPlan(
  actor: Actor,
  input: GeneratePlanInput,
  payload: GeneratedPlanPayload,
  context: AssistantContext,
  meta: { conversationId?: string; provider: string; model: string },
): Promise<PlanView> {
  const today = context.today

  // Everything already planned in the horizon, for duplicate detection.
  const [existingTasks, existingBlocks] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: actor.userId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        scheduledDate: { gte: isoDateToUtcDate(today), lte: isoDateToUtcDate(addDays(today, 60)) },
      },
      select: { id: true, title: true, scheduledDate: true },
    }),
    prisma.plannerBlock.findMany({
      where: {
        userId: actor.userId,
        deletedAt: null,
        localDate: { gte: isoDateToUtcDate(today), lte: isoDateToUtcDate(addDays(today, 60)) },
      },
      select: { id: true, localDate: true, startTime: true, endTime: true },
    }),
  ])

  const taskIndex = new Map<string, string>()
  for (const task of existingTasks) {
    const date = task.scheduledDate ? utcDateToIsoDate(task.scheduledDate) : 'undated'
    taskIndex.set(`${normaliseTitle(task.title)}|${date}`, task.id)
  }

  const prayerSettings = await getPrayerSettings(actor)

  const seenKeys = new Set<string>()
  const itemRows: Prisma.GeneratedPlanItemCreateManyPlanInput[] = []
  const warningsByKey = new Map<string, string[]>()

  let duplicateCount = 0
  let conflictCount = 0

  for (const [index, item] of payload.items.entries()) {
    const localDate = resolveDate(item, today)
    const key = buildItemKey(item.kind, item.title, localDate, item.startTime ?? null)

    // The model can repeat itself; the unique constraint would reject the second
    // one, so it is dropped here rather than failing the whole plan.
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const warnings: string[] = []
    let duplicateOfTaskId: string | null = null

    if (item.kind === 'TASK') {
      const existingId = taskIndex.get(`${normaliseTitle(item.title)}|${localDate ?? 'undated'}`)
      if (existingId) {
        duplicateOfTaskId = existingId
        duplicateCount += 1
        warnings.push('Already in your planner')
      }
    }

    if (item.kind === 'BLOCK' && localDate && item.startTime && item.endTime) {
      const range = { startTime: item.startTime, endTime: item.endTime }

      // Overlap with existing blocks — deterministic, using the planner's own rule.
      const overlapping = existingBlocks.filter(
        (block) =>
          utcDateToIsoDate(block.localDate) === localDate &&
          rangesOverlap({ startTime: block.startTime, endTime: block.endTime }, range),
      )
      if (overlapping.length > 0) {
        conflictCount += 1
        warnings.push('Overlaps something already blocked out')
      }

      // Prayer conflicts, from the prayer service — never from the model.
      if (prayerSettings) {
        const times = computeForDay(prayerSettings, localDate).times
        for (const entry of times.times) {
          const at = instantToClockTime(entry.time, actor.timezone)
          if (timeWithinRange(at, range)) {
            conflictCount += 1
            warnings.push(`${PRAYER_LABELS[entry.prayer].latin} falls inside this block at ${at}`)
          }
        }
      }

      if (toMinutes(item.endTime) <= toMinutes(item.startTime)) {
        warnings.push('Invalid time range')
      }
    }

    if (warnings.length > 0) warningsByKey.set(key, warnings)

    itemRows.push({
      userId: actor.userId,
      kind: item.kind,
      // Duplicates are surfaced and deselected by default, never silently dropped.
      status: duplicateOfTaskId ? 'DUPLICATE' : 'PROPOSED',
      title: item.title,
      description: item.description ?? null,
      localDate: localDate ? isoDateToUtcDate(localDate) : null,
      startTime: item.startTime ?? item.preferredTime ?? null,
      endTime: item.endTime ?? null,
      estimatedMinutes: item.estimatedMinutes ?? null,
      category: item.category ?? null,
      itemKey: key,
      duplicateOfTaskId,
      sortOrder: index,
    })
  }

  const plan = await prisma.generatedPlan.create({
    data: {
      userId: actor.userId,
      conversationId: meta.conversationId ?? null,
      type: input.type as GeneratorType,
      title: payload.title,
      // READY, never APPLIED. Only an explicit confirmation can apply a plan.
      status: 'READY',
      structuredContent: { ...payload, warnings: Object.fromEntries(warningsByKey) },
      generatorVersion: GENERATOR_VERSION,
      provider: meta.provider,
      model: meta.model,
      items: { createMany: { data: itemRows } },
    },
    select: PLAN_SELECT,
  })

  await track(actor.userId, ANALYTICS_EVENTS.GENERATED_PLAN_CREATED, {
    itemCount: itemRows.length,
    duplicateCount,
    conflictCount,
  })

  return toPlanView(plan, warningsByKey)
}

/** Resolve a relative offset against the member's own local day. */
function resolveDate(item: GeneratedItem, today: IsoDate): IsoDate | null {
  if (item.dayOffset === undefined) return null
  return addDays(today, item.dayOffset)
}

const PLAN_SELECT = {
  id: true,
  type: true,
  title: true,
  status: true,
  structuredContent: true,
  createdAt: true,
  appliedAt: true,
  provider: true,
  items: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      kind: true,
      status: true,
      title: true,
      description: true,
      localDate: true,
      startTime: true,
      endTime: true,
      estimatedMinutes: true,
      category: true,
      itemKey: true,
      duplicateOfTaskId: true,
      taskId: true,
      blockId: true,
    },
  },
} satisfies Prisma.GeneratedPlanSelect

type PlanRow = Prisma.GeneratedPlanGetPayload<{ select: typeof PLAN_SELECT }>

export function toPlanView(plan: PlanRow, warningsByKey?: Map<string, string[]>): PlanView {
  const stored =
    plan.structuredContent && typeof plan.structuredContent === 'object'
      ? (plan.structuredContent as { summary?: string; warnings?: Record<string, string[]> })
      : {}

  const warnings = warningsByKey ?? new Map(Object.entries(stored.warnings ?? {}))

  return {
    id: plan.id,
    type: plan.type,
    title: plan.title,
    summary: stored.summary ?? '',
    status: plan.status,
    createdAt: plan.createdAt,
    appliedAt: plan.appliedAt,
    isDemoProvider: plan.provider === 'mock',
    items: plan.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      title: item.title,
      description: item.description,
      localDate: item.localDate ? utcDateToIsoDate(item.localDate) : null,
      startTime: item.startTime,
      endTime: item.endTime,
      estimatedMinutes: item.estimatedMinutes,
      category: item.category,
      duplicateOfTaskId: item.duplicateOfTaskId,
      warnings: warnings.get(item.itemKey) ?? [],
      taskId: item.taskId,
      blockId: item.blockId,
    })),
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getPlan(actor: Actor, planId: string): Promise<PlanView | null> {
  const plan = await prisma.generatedPlan.findFirst({
    where: { id: planId, userId: actor.userId, deletedAt: null },
    select: PLAN_SELECT,
  })

  return plan ? toPlanView(plan) : null
}

export async function listPlans(actor: Actor, take = 20): Promise<PlanView[]> {
  const plans = await prisma.generatedPlan.findMany({
    where: { userId: actor.userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: PLAN_SELECT,
  })

  return plans.map((plan) => toPlanView(plan))
}

export { isLiveProvider, AiError }
