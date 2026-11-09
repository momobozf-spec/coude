import 'server-only'

import type { Prisma, PlannerBlockType } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { isoDateToUtcDate, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import {
  durationMinutes,
  instantToClockTime,
  rangesOverlap,
  timeWithinRange,
  type ClockTime,
} from '@/lib/planner/time'
import { PRAYER_LABELS, type Prayer } from '@/lib/prayer/types'
import type { PrayerTimesResult } from '@/lib/prayer/calculate'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { clockTimeSchema, isoDateSchema } from '@/server/modules/planner/task.schema'

export const PLANNER_BLOCK_TYPES = [
  'FOCUS',
  'TASK',
  'APPOINTMENT',
  'PERSONAL',
  'CUSTOM',
] as const satisfies readonly PlannerBlockType[]

export const createBlockSchema = z.object({
  title: z.string().trim().min(1, 'Give the block a title.').max(200),
  note: z.string().trim().max(1000).nullable().optional(),
  localDate: isoDateSchema,
  startTime: clockTimeSchema,
  endTime: clockTimeSchema,
  type: z.enum(PLANNER_BLOCK_TYPES).default('FOCUS'),
  taskId: z.string().uuid().nullable().optional(),
})

export type CreateBlockInput = z.infer<typeof createBlockSchema>

export const updateBlockSchema = createBlockSchema.partial().omit({ localDate: true })
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>

export interface BlockView {
  id: string
  title: string
  note: string | null
  localDate: IsoDate
  startTime: ClockTime
  endTime: ClockTime
  type: PlannerBlockType
  taskId: string | null
  taskTitle: string | null
}

const BLOCK_SELECT = {
  id: true,
  title: true,
  note: true,
  localDate: true,
  startTime: true,
  endTime: true,
  type: true,
  taskId: true,
  task: { select: { title: true } },
} satisfies Prisma.PlannerBlockSelect

type BlockRow = Prisma.PlannerBlockGetPayload<{ select: typeof BLOCK_SELECT }>

function toBlockView(block: BlockRow): BlockView {
  return {
    id: block.id,
    title: block.title,
    note: block.note,
    localDate: utcDateToIsoDate(block.localDate),
    startTime: block.startTime,
    endTime: block.endTime,
    type: block.type,
    taskId: block.taskId,
    taskTitle: block.task?.title ?? null,
  }
}

// ─── Prayer conflicts ────────────────────────────────────────────────────────

export interface PrayerConflict {
  prayer: Prayer
  prayerLabel: string
  /** Local wall-clock time the prayer begins, "HH:mm". */
  at: ClockTime
  /** Suggested end time if the user wants to finish before the prayer. */
  endBefore: ClockTime
  /** Suggested start time if the user wants to resume after it. */
  resumeAfter: ClockTime
}

/** Minutes reserved after the adhan when suggesting "continue after". */
const PRAYER_ALLOWANCE_MINUTES = 20

/**
 * Which prayers fall inside a proposed block.
 *
 * Advisory only — this never blocks a save. The user may have perfectly good
 * reasons, and a planner that refuses to let someone schedule a meeting is a
 * planner they stop using. We surface the conflict and let them decide.
 */
export function findPrayerConflicts(
  range: { startTime: ClockTime; endTime: ClockTime },
  prayerTimes: PrayerTimesResult,
  timezone: string,
): PrayerConflict[] {
  const conflicts: PrayerConflict[] = []

  for (const entry of prayerTimes.times) {
    const at = instantToClockTime(entry.time, timezone)
    if (!timeWithinRange(at, range)) continue

    const [hours = '0', minutes = '0'] = at.split(':')
    const atMinutes = Number(hours) * 60 + Number(minutes)

    conflicts.push({
      prayer: entry.prayer,
      prayerLabel: PRAYER_LABELS[entry.prayer].latin,
      at,
      endBefore: at,
      resumeAfter: formatMinutes(atMinutes + PRAYER_ALLOWANCE_MINUTES),
    })
  }

  return conflicts
}

function formatMinutes(total: number): ClockTime {
  const normalised = Math.min(total, 23 * 60 + 59)
  const hours = Math.floor(normalised / 60)
  const mins = normalised % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listBlocksForDay(actor: Actor, date: IsoDate): Promise<BlockView[]> {
  const blocks = await prisma.plannerBlock.findMany({
    where: { userId: actor.userId, localDate: isoDateToUtcDate(date), deletedAt: null },
    orderBy: [{ startTime: 'asc' }],
    select: BLOCK_SELECT,
  })

  return blocks.map(toBlockView)
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function assertValidRange(startTime: ClockTime, endTime: ClockTime) {
  const length = durationMinutes(startTime, endTime)

  if (length <= 0) {
    // Blocks are single-day by design. A block that "crosses midnight" is two
    // blocks on two local days; modelling it as one would break every
    // per-day query and the timeline ordering.
    throw new ValidationError(
      'A block must end after it starts, on the same day. For an overnight period, create one block per day.',
    )
  }

  if (length > 12 * 60) {
    throw new ValidationError('Blocks longer than 12 hours are probably not what you meant.')
  }
}

export async function createBlock(
  actor: Actor,
  input: CreateBlockInput,
  options: { hadPrayerConflict?: boolean } = {},
): Promise<BlockView> {
  const data = createBlockSchema.parse(input)
  assertValidRange(data.startTime, data.endTime)

  // A linked task must belong to the caller.
  if (data.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    })
    if (!task) throw new NotFoundError('Task')
  }

  const block = await prisma.plannerBlock.create({
    data: {
      userId: actor.userId,
      title: data.title,
      note: data.note ?? null,
      localDate: isoDateToUtcDate(data.localDate),
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      taskId: data.taskId ?? null,
    },
    select: BLOCK_SELECT,
  })

  await track(actor.userId, ANALYTICS_EVENTS.PLANNER_BLOCK_CREATED, {
    durationMinutes: durationMinutes(data.startTime, data.endTime),
    hadPrayerConflict: options.hadPrayerConflict ?? false,
  })

  return toBlockView(block)
}

export async function updateBlock(
  actor: Actor,
  blockId: string,
  input: UpdateBlockInput,
): Promise<BlockView> {
  const data = updateBlockSchema.parse(input)

  const existing = await prisma.plannerBlock.findFirst({
    where: { id: blockId, userId: actor.userId, deletedAt: null },
    select: { id: true, startTime: true, endTime: true },
  })
  if (!existing) throw new NotFoundError('Planner block')

  const startTime = data.startTime ?? existing.startTime
  const endTime = data.endTime ?? existing.endTime
  assertValidRange(startTime, endTime)

  const block = await prisma.plannerBlock.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.taskId !== undefined ? { taskId: data.taskId } : {}),
      startTime,
      endTime,
    },
    select: BLOCK_SELECT,
  })

  return toBlockView(block)
}

export async function deleteBlock(actor: Actor, blockId: string): Promise<IsoDate> {
  const existing = await prisma.plannerBlock.findFirst({
    where: { id: blockId, userId: actor.userId, deletedAt: null },
    select: { id: true, localDate: true },
  })
  if (!existing) throw new NotFoundError('Planner block')

  await prisma.plannerBlock.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  })

  return utcDateToIsoDate(existing.localDate)
}

/**
 * Blocks on the same day whose times overlap a proposed range.
 *
 * Overlapping blocks are permitted — people double-book, and refusing the save
 * would be worse than showing it. This exists so the UI can say so.
 */
export async function findOverlappingBlocks(
  actor: Actor,
  date: IsoDate,
  range: { startTime: ClockTime; endTime: ClockTime },
  excludeBlockId?: string,
): Promise<BlockView[]> {
  const blocks = await listBlocksForDay(actor, date)

  return blocks.filter(
    (block) => block.id !== excludeBlockId && rangesOverlap(block, range),
  )
}
