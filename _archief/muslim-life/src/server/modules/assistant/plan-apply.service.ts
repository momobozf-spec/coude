import 'server-only'

import { Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/lib/errors'
import { isoDateToUtcDate, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import { durationMinutes } from '@/lib/planner/time'
import { recomputeDailySummary } from '@/server/modules/my-day/my-day.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { getPlan, toPlanView, type PlanView } from '@/server/modules/assistant/plan-generator.service'
import { applyPlanSchema, type PlanSelection } from '@/server/modules/assistant/plan.schema'

/**
 * Applying a generated plan.
 *
 * The single doorway from AI proposal to real planner data. Nothing else may
 * create a task or a block from a plan.
 *
 * Guarantees:
 *  - ownership checked before anything is read
 *  - only `READY` plans can be applied; `APPLIED` throws rather than duplicating
 *  - member edits are re-validated exactly like generated content
 *  - the whole apply is one transaction — a partial failure leaves nothing behind
 *  - items are marked with the row they created, so suggestion → task is traceable
 *  - a second click is a no-op, enforced by item status inside the transaction
 */

export class PlanError extends AppError {
  constructor(
    code: 'PLAN_NOT_FOUND' | 'PLAN_ALREADY_APPLIED' | 'PLAN_ITEM_INVALID',
    message: string,
    status: number,
  ) {
    super(code === 'PLAN_NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', message, {
      status,
      meta: { planCode: code },
    })
  }
}

export interface ApplyResult {
  plan: PlanView
  tasksCreated: number
  blocksCreated: number
  skipped: number
}

export async function applyGeneratedPlan(
  actor: Actor,
  input: unknown,
): Promise<ApplyResult> {
  const { planId, selections } = applyPlanSchema.parse(input)

  // 1. Ownership. Scoped in the WHERE clause, so another member's plan simply
  //    does not exist from here.
  const plan = await prisma.generatedPlan.findFirst({
    where: { id: planId, userId: actor.userId, deletedAt: null },
    select: {
      id: true,
      status: true,
      items: {
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
        },
      },
    },
  })

  if (!plan) throw new PlanError('PLAN_NOT_FOUND', 'That plan could not be found.', 404)

  // 2. Status. An applied plan is history — regenerate instead of re-applying.
  if (plan.status === 'APPLIED') {
    throw new PlanError(
      'PLAN_ALREADY_APPLIED',
      'This plan has already been added to your planner.',
      409,
    )
  }
  if (plan.status === 'ARCHIVED') {
    throw new PlanError('PLAN_ALREADY_APPLIED', 'This plan has been archived.', 409)
  }

  const itemsById = new Map(plan.items.map((item) => [item.id, item]))

  // 3. Validate selections against the plan's own items.
  const resolved: ResolvedSelection[] = []

  for (const selection of selections) {
    const item = itemsById.get(selection.itemId)
    if (!item) {
      throw new PlanError('PLAN_ITEM_INVALID', 'That item is not part of this plan.', 400)
    }

    // Already applied in an earlier partial apply — silently skip so a repeat
    // submission cannot double-create.
    if (item.status === 'APPLIED') continue

    // Notes and habit suggestions are guidance, not planner rows.
    if (item.kind === 'NOTE' || item.kind === 'HABIT_SUGGESTION') continue

    resolved.push(buildResolved(item, selection))
  }

  if (resolved.length === 0) {
    throw new ValidationError('Nothing was selected to add.')
  }

  // 4. Duplicate detection against the live planner, at apply time rather than
  //    generation time — the planner may have changed since.
  const dates = [...new Set(resolved.map((entry) => entry.localDate).filter(Boolean))] as IsoDate[]

  const existing = dates.length
    ? await prisma.task.findMany({
        where: {
          userId: actor.userId,
          deletedAt: null,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          scheduledDate: { in: dates.map(isoDateToUtcDate) },
        },
        select: { id: true, title: true, scheduledDate: true },
      })
    : []

  const existingKeys = new Set(
    existing.map(
      (task) =>
        `${task.title.trim().toLowerCase()}|${task.scheduledDate ? utcDateToIsoDate(task.scheduledDate) : 'undated'}`,
    ),
  )

  // 5. Create everything in one transaction.
  const affectedDates = new Set<IsoDate>()
  let tasksCreated = 0
  let blocksCreated = 0
  let skipped = 0

  try {
    await prisma.$transaction(async (tx) => {
      // Re-read status inside the transaction, so two concurrent applies cannot
      // both pass the check above.
      const current = await tx.generatedPlan.findUniqueOrThrow({
        where: { id: plan.id },
        select: { status: true },
      })
      if (current.status === 'APPLIED') {
        throw new ConflictError('This plan has already been added to your planner.')
      }

      for (const entry of resolved) {
        const dupeKey = `${entry.title.trim().toLowerCase()}|${entry.localDate ?? 'undated'}`

        if (entry.kind === 'TASK' && existingKeys.has(dupeKey)) {
          await tx.generatedPlanItem.update({
            where: { id: entry.itemId },
            data: { status: 'DUPLICATE' },
          })
          skipped += 1
          continue
        }

        if (entry.kind === 'TASK') {
          const task = await tx.task.create({
            data: {
              userId: actor.userId,
              title: entry.title,
              description: entry.description,
              scheduledDate: entry.localDate ? isoDateToUtcDate(entry.localDate) : null,
              scheduledTime: entry.startTime,
              estimatedMinutes: entry.estimatedMinutes,
              category: entry.category as never,
              source: 'AI',
              generatedPlanId: plan.id,
            },
            select: { id: true },
          })

          await tx.generatedPlanItem.update({
            where: { id: entry.itemId },
            data: { status: 'APPLIED', taskId: task.id },
          })

          tasksCreated += 1
          if (entry.localDate) affectedDates.add(entry.localDate)
          existingKeys.add(dupeKey)
          continue
        }

        // BLOCK
        if (!entry.localDate || !entry.startTime || !entry.endTime) {
          skipped += 1
          continue
        }

        const block = await tx.plannerBlock.create({
          data: {
            userId: actor.userId,
            title: entry.title,
            note: entry.description,
            localDate: isoDateToUtcDate(entry.localDate),
            startTime: entry.startTime,
            endTime: entry.endTime,
            type: 'FOCUS',
          },
          select: { id: true },
        })

        await tx.generatedPlanItem.update({
          where: { id: entry.itemId },
          data: { status: 'APPLIED', blockId: block.id },
        })

        blocksCreated += 1
        affectedDates.add(entry.localDate)
      }

      // Mark anything the member did not select, so a partial apply is recorded
      // rather than leaving items looking pending forever.
      const selectedIds = new Set(resolved.map((entry) => entry.itemId))
      await tx.generatedPlanItem.updateMany({
        where: {
          planId: plan.id,
          status: 'PROPOSED',
          id: { notIn: [...selectedIds] },
        },
        data: { status: 'SKIPPED' },
      })

      await tx.generatedPlan.update({
        where: { id: plan.id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Some of these items are already in your planner.')
    }
    throw error
  }

  // 6. Refresh the day summaries the new rows affect.
  for (const date of affectedDates) {
    await recomputeDailySummary(actor, date)
  }

  await track(actor.userId, ANALYTICS_EVENTS.GENERATED_PLAN_APPLIED, {
    selectedCount: resolved.length,
    taskCount: tasksCreated,
    blockCount: blocksCreated,
  })

  const updated = await getPlan(actor, plan.id)
  if (!updated) throw new NotFoundError('Plan')

  return { plan: updated, tasksCreated, blocksCreated, skipped }
}

interface ResolvedSelection {
  itemId: string
  kind: 'TASK' | 'BLOCK'
  title: string
  description: string | null
  localDate: IsoDate | null
  startTime: string | null
  endTime: string | null
  estimatedMinutes: number | null
  category: string | null
}

/**
 * Merge a member's preview edits over the generated item.
 *
 * The edits go through the same validation as generated content — by this point
 * where the value came from is irrelevant, and trusting client input because a
 * human touched it is how bad data gets in.
 */
function buildResolved(
  item: {
    id: string
    kind: string
    title: string
    description: string | null
    localDate: Date | null
    startTime: string | null
    endTime: string | null
    estimatedMinutes: number | null
    category: string | null
  },
  selection: PlanSelection,
): ResolvedSelection {
  const localDate =
    selection.localDate !== undefined
      ? selection.localDate
      : item.localDate
        ? utcDateToIsoDate(item.localDate)
        : null

  const startTime = selection.startTime ?? item.startTime
  const endTime = selection.endTime ?? item.endTime

  if (item.kind === 'BLOCK') {
    if (!startTime || !endTime) {
      throw new PlanError('PLAN_ITEM_INVALID', 'A time block needs a start and an end.', 400)
    }
    if (durationMinutes(startTime, endTime) <= 0) {
      throw new PlanError('PLAN_ITEM_INVALID', 'A block must end after it starts.', 400)
    }
    if (!localDate) {
      throw new PlanError('PLAN_ITEM_INVALID', 'A time block needs a date.', 400)
    }
  }

  // A time without a date is the same error the planner rejects directly.
  if (item.kind === 'TASK' && startTime && !localDate) {
    throw new PlanError('PLAN_ITEM_INVALID', 'A time needs a date.', 400)
  }

  return {
    itemId: item.id,
    kind: item.kind === 'BLOCK' ? 'BLOCK' : 'TASK',
    title: (selection.title ?? item.title).trim(),
    description: item.description,
    localDate,
    startTime,
    endTime,
    estimatedMinutes:
      selection.estimatedMinutes !== undefined
        ? selection.estimatedMinutes
        : item.estimatedMinutes,
    category: item.category,
  }
}

/** Archive a plan without touching anything it created. */
export async function archivePlan(actor: Actor, planId: string): Promise<void> {
  const { count } = await prisma.generatedPlan.updateMany({
    where: { id: planId, userId: actor.userId, deletedAt: null },
    data: { status: 'ARCHIVED' },
  })

  if (count === 0) throw new PlanError('PLAN_NOT_FOUND', 'That plan could not be found.', 404)
}

export { toPlanView }
