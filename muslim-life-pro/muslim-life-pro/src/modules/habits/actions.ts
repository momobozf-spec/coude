'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import {
  createHabit,
  createHabitFromTemplate,
  createHabitSchema,
  deleteHabit,
  logHabit,
  setHabitActive,
  toggleHabit,
  updateHabit,
  updateHabitSchema,
  type HabitView,
  type LogHabitResult,
} from '@/server/modules/habits/habit.service'
import { recomputeDailySummary } from '@/server/modules/my-day/my-day.service'
import { isoDateSchema } from '@/server/modules/planner/task.schema'

const PATHS = ['/app', '/app/habits'] as const

function revalidateHabits() {
  for (const path of PATHS) revalidatePath(path)
}

export async function createHabitAction(input: unknown): Promise<ActionResult<HabitView>> {
  try {
    const actor = await requireActor()
    const habit = await createHabit(actor, createHabitSchema.parse(input))

    revalidateHabits()
    return actionOk(habit)
  } catch (error) {
    return actionError(error)
  }
}

export async function createHabitFromTemplateAction(
  input: unknown,
): Promise<ActionResult<HabitView>> {
  try {
    const actor = await requireActor()
    const { templateKey } = z.object({ templateKey: z.string().min(1).max(60) }).parse(input)

    const habit = await createHabitFromTemplate(actor, templateKey)

    revalidateHabits()
    return actionOk(habit)
  } catch (error) {
    return actionError(error)
  }
}

const updateActionSchema = z.object({
  habitId: z.string().uuid(),
  patch: updateHabitSchema,
})

export async function updateHabitAction(input: unknown): Promise<ActionResult<HabitView>> {
  try {
    const actor = await requireActor()
    const { habitId, patch } = updateActionSchema.parse(input)

    const habit = await updateHabit(actor, habitId, patch)

    revalidateHabits()
    return actionOk(habit)
  } catch (error) {
    return actionError(error)
  }
}

export async function setHabitActiveAction(input: unknown): Promise<ActionResult<HabitView>> {
  try {
    const actor = await requireActor()
    const { habitId, active } = z
      .object({ habitId: z.string().uuid(), active: z.boolean() })
      .parse(input)

    const habit = await setHabitActive(actor, habitId, active)

    revalidateHabits()
    return actionOk(habit)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteHabitAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { habitId } = z.object({ habitId: z.string().uuid() }).parse(input)

    await deleteHabit(actor, habitId)

    revalidateHabits()
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

const toggleSchema = z.object({
  habitId: z.string().uuid(),
  localDate: isoDateSchema,
})

/** One-tap completion for boolean habits. */
export async function toggleHabitAction(input: unknown): Promise<ActionResult<LogHabitResult>> {
  try {
    const actor = await requireActor()
    const { habitId, localDate } = toggleSchema.parse(input)

    const result = await toggleHabit(actor, habitId, localDate)
    await recomputeDailySummary(actor, localDate)

    revalidateHabits()
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}

const logSchema = z.object({
  habitId: z.string().uuid(),
  localDate: isoDateSchema,
  status: z.enum(['COMPLETED', 'PARTIAL', 'SKIPPED']).nullable(),
  quantity: z.number().int().min(0).max(100_000).nullable().optional(),
})

/** Explicit logging: a quantity, a partial day, or a deliberate skip. */
export async function logHabitAction(input: unknown): Promise<ActionResult<LogHabitResult>> {
  try {
    const actor = await requireActor()
    const { habitId, localDate, status, quantity } = logSchema.parse(input)

    const result = await logHabit(actor, habitId, localDate, { status, quantity })
    await recomputeDailySummary(actor, localDate)

    revalidateHabits()
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}
