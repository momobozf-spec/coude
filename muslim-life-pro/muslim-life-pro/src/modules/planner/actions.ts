'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { todayIn } from '@/lib/dates'
import { parseQuickAdd } from '@/lib/planner/quick-add'
import {
  createTask,
  deleteTask,
  setDailyPriorities,
  setTaskStatus,
  toggleDailyPriority,
  reorderTasks,
  updateTask,
  type TaskView,
} from '@/server/modules/planner/task.service'
import {
  createBlock,
  deleteBlock,
  findPrayerConflicts,
  updateBlock,
  type BlockView,
  type PrayerConflict,
} from '@/server/modules/planner/planner-block.service'
import { computeForDay, getPrayerSettings } from '@/server/modules/prayer/prayer.service'
import { recomputeDailySummary } from '@/server/modules/my-day/my-day.service'
import {
  clockTimeSchema,
  createTaskSchema,
  isoDateSchema,
  setPrioritiesSchema,
  updateTaskSchema,
} from '@/server/modules/planner/task.schema'
import { createBlockSchema, updateBlockSchema } from '@/server/modules/planner/planner-block.service'

/**
 * Server actions for the planner.
 *
 * These are transport, not logic: parse the input, call a service, revalidate.
 * Every rule (ownership, the three-priority cap, block validity, prayer overlap)
 * lives in `src/server/modules/planner/*`.
 */

const APP_PATHS = ['/app', '/app/planner'] as const

function revalidatePlanner() {
  for (const path of APP_PATHS) revalidatePath(path)
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function createTaskAction(input: unknown): Promise<ActionResult<TaskView>> {
  try {
    const actor = await requireActor()
    const task = await createTask(actor, createTaskSchema.parse(input))

    if (task.scheduledDate) await recomputeDailySummary(actor, task.scheduledDate)
    revalidatePlanner()

    return actionOk(task)
  } catch (error) {
    return actionError(error)
  }
}

const quickAddSchema = z.object({
  text: z.string().trim().min(1, 'Type something to add.').max(300),
  /** Optional override; defaults to the user's local today. */
  today: isoDateSchema.optional(),
  /**
   * Day to fall back to when the text implies no date. The Today view passes
   * its own day so a task typed there lands there; the Inbox omits it so the
   * task stays unscheduled.
   */
  defaultDate: isoDateSchema.nullable().optional(),
})

/**
 * Quick add from a single line of text.
 *
 * Parsing is deterministic and happens server-side so the same phrase always
 * yields the same task, and so the parser can be tested without a browser.
 */
export async function quickAddTaskAction(
  input: unknown,
): Promise<ActionResult<{ task: TaskView; matched: string[] }>> {
  try {
    const actor = await requireActor()
    const { text, today, defaultDate } = quickAddSchema.parse(input)

    const localToday = today ?? todayIn(actor.timezone)
    const parsed = parseQuickAdd(text, localToday)

    const task = await createTask(actor, {
      title: parsed.title,
      scheduledDate: parsed.scheduledDate ?? defaultDate ?? null,
      scheduledTime: parsed.scheduledTime,
      priority: parsed.priority,
      isDailyPriority: false,
    })

    if (task.scheduledDate) await recomputeDailySummary(actor, task.scheduledDate)
    revalidatePlanner()

    return actionOk({ task, matched: parsed.matched })
  } catch (error) {
    return actionError(error)
  }
}

const updateActionSchema = z.object({
  taskId: z.string().uuid(),
  patch: updateTaskSchema,
})

export async function updateTaskAction(input: unknown): Promise<ActionResult<TaskView>> {
  try {
    const actor = await requireActor()
    const { taskId, patch } = updateActionSchema.parse(input)

    const task = await updateTask(actor, taskId, patch)

    if (task.scheduledDate) await recomputeDailySummary(actor, task.scheduledDate)
    revalidatePlanner()

    return actionOk(task)
  } catch (error) {
    return actionError(error)
  }
}

const setStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
})

export async function setTaskStatusAction(input: unknown): Promise<ActionResult<TaskView>> {
  try {
    const actor = await requireActor()
    const { taskId, status } = setStatusSchema.parse(input)

    const { date, task } = await setTaskStatus(actor, taskId, status)

    if (date) await recomputeDailySummary(actor, date)
    revalidatePlanner()

    return actionOk(task)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteTaskAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(input)

    const date = await deleteTask(actor, taskId)

    if (date) await recomputeDailySummary(actor, date)
    revalidatePlanner()

    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleTaskPriorityAction(
  input: unknown,
): Promise<ActionResult<{ isDailyPriority: boolean }>> {
  try {
    const actor = await requireActor()
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(input)

    const result = await toggleDailyPriority(actor, taskId)
    revalidatePlanner()

    return actionOk({ isDailyPriority: result.isDailyPriority })
  } catch (error) {
    return actionError(error)
  }
}

export async function setPrioritiesAction(input: unknown): Promise<ActionResult<TaskView[]>> {
  try {
    const actor = await requireActor()
    const { date, taskIds } = setPrioritiesSchema.parse(input)

    const priorities = await setDailyPriorities(actor, date, taskIds)
    revalidatePlanner()

    return actionOk(priorities)
  } catch (error) {
    return actionError(error)
  }
}

export async function reorderTasksAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { orderedIds } = z
      .object({ orderedIds: z.array(z.string().uuid()).max(200) })
      .parse(input)

    await reorderTasks(actor, orderedIds)
    revalidatePlanner()

    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

// ─── Planner blocks ──────────────────────────────────────────────────────────

const conflictCheckSchema = z.object({
  localDate: isoDateSchema,
  startTime: clockTimeSchema,
  endTime: clockTimeSchema,
})

/**
 * Which prayers fall inside a proposed block.
 *
 * Advisory only — this never prevents a save. It exists so the composer can say
 * "Asr starts during this block at 16:42" and offer to adjust.
 */
export async function checkPrayerConflictsAction(
  input: unknown,
): Promise<ActionResult<PrayerConflict[]>> {
  try {
    const actor = await requireActor()
    const range = conflictCheckSchema.parse(input)

    const settings = await getPrayerSettings(actor)
    if (!settings) return actionOk([])

    const { times } = computeForDay(settings, range.localDate)
    return actionOk(findPrayerConflicts(range, times, actor.timezone))
  } catch (error) {
    return actionError(error)
  }
}

const createBlockActionSchema = createBlockSchema.extend({
  hadPrayerConflict: z.boolean().default(false),
})

export async function createBlockAction(input: unknown): Promise<ActionResult<BlockView>> {
  try {
    const actor = await requireActor()
    const { hadPrayerConflict, ...data } = createBlockActionSchema.parse(input)

    const block = await createBlock(actor, data, { hadPrayerConflict })

    await recomputeDailySummary(actor, block.localDate)
    revalidatePlanner()

    return actionOk(block)
  } catch (error) {
    return actionError(error)
  }
}

const updateBlockActionSchema = z.object({
  blockId: z.string().uuid(),
  patch: updateBlockSchema,
})

export async function updateBlockAction(input: unknown): Promise<ActionResult<BlockView>> {
  try {
    const actor = await requireActor()
    const { blockId, patch } = updateBlockActionSchema.parse(input)

    const block = await updateBlock(actor, blockId, patch)
    revalidatePlanner()

    return actionOk(block)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteBlockAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { blockId } = z.object({ blockId: z.string().uuid() }).parse(input)

    await deleteBlock(actor, blockId)
    revalidatePlanner()

    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
