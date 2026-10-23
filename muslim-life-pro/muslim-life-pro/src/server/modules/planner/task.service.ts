import 'server-only'

import type { Prisma, Task, TaskStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { isoDateToUtcDate, utcDateToIsoDate, type IsoDate } from '@/lib/dates'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/server/modules/planner/task.schema'

/**
 * Tasks.
 *
 * Every query is scoped by `userId` inside the WHERE clause rather than
 * fetched-then-checked, so a task belonging to another member simply does not
 * match. This is what makes IDOR structurally impossible rather than merely
 * guarded against.
 */

/** Maximum tasks a user may flag as a priority for one day. */
export const MAX_DAILY_PRIORITIES = 3

export interface TaskView {
  id: string
  title: string
  description: string | null
  scheduledDate: IsoDate | null
  scheduledTime: string | null
  dueDate: IsoDate | null
  estimatedMinutes: number | null
  category: string | null
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  status: TaskStatus
  isDailyPriority: boolean
  priorityOrder: number | null
  completedAt: Date | null
  sortOrder: number
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  scheduledDate: true,
  scheduledTime: true,
  dueDate: true,
  estimatedMinutes: true,
  category: true,
  priority: true,
  status: true,
  isDailyPriority: true,
  priorityOrder: true,
  completedAt: true,
  sortOrder: true,
} satisfies Prisma.TaskSelect

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>

export function toTaskView(task: TaskRow): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    scheduledDate: task.scheduledDate ? utcDateToIsoDate(task.scheduledDate) : null,
    scheduledTime: task.scheduledTime,
    dueDate: task.dueDate ? utcDateToIsoDate(task.dueDate) : null,
    estimatedMinutes: task.estimatedMinutes,
    category: task.category,
    priority: task.priority,
    status: task.status,
    isDailyPriority: task.isDailyPriority,
    priorityOrder: task.priorityOrder,
    completedAt: task.completedAt,
    sortOrder: task.sortOrder,
  }
}

/** Statuses that still need doing. */
export const OPEN_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS']

const notDeleted = { deletedAt: null } as const

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Today: everything scheduled for this local day, plus anything overdue. */
export async function listToday(actor: Actor, date: IsoDate): Promise<TaskView[]> {
  const day = isoDateToUtcDate(date)

  const tasks = await prisma.task.findMany({
    where: {
      userId: actor.userId,
      ...notDeleted,
      OR: [
        { scheduledDate: day },
        // Overdue open tasks surface today rather than silently disappearing
        // into the past, which is the failure mode of most planners.
        { scheduledDate: { lt: day }, status: { in: OPEN_STATUSES } },
      ],
    },
    orderBy: [
      { isDailyPriority: 'desc' },
      { priorityOrder: 'asc' },
      { scheduledTime: 'asc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
    select: TASK_SELECT,
  })

  return tasks.map(toTaskView)
}

/** Inbox: captured but not yet scheduled. */
export async function listInbox(actor: Actor): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId: actor.userId,
      ...notDeleted,
      scheduledDate: null,
      status: { in: OPEN_STATUSES },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: TASK_SELECT,
  })

  return tasks.map(toTaskView)
}

/** Upcoming: scheduled after today, grouped by day. */
export async function listUpcoming(
  actor: Actor,
  fromDate: IsoDate,
  days = 14,
): Promise<{ date: IsoDate; tasks: TaskView[] }[]> {
  const start = isoDateToUtcDate(fromDate)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + days)

  const tasks = await prisma.task.findMany({
    where: {
      userId: actor.userId,
      ...notDeleted,
      scheduledDate: { gt: start, lte: end },
      status: { in: OPEN_STATUSES },
    },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }, { sortOrder: 'asc' }],
    select: TASK_SELECT,
  })

  const grouped = new Map<IsoDate, TaskView[]>()
  for (const task of tasks) {
    if (!task.scheduledDate) continue
    const key = utcDateToIsoDate(task.scheduledDate)
    const bucket = grouped.get(key)
    if (bucket) bucket.push(toTaskView(task))
    else grouped.set(key, [toTaskView(task)])
  }

  return [...grouped.entries()].map(([date, items]) => ({ date, tasks: items }))
}

export async function getTask(actor: Actor, taskId: string): Promise<TaskView> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: actor.userId, ...notDeleted },
    select: TASK_SELECT,
  })
  if (!task) throw new NotFoundError('Task')
  return toTaskView(task)
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createTask(actor: Actor, input: CreateTaskInput): Promise<TaskView> {
  const data = createTaskSchema.parse(input)

  if (data.scheduledTime && !data.scheduledDate) {
    throw new ValidationError('A time needs a date. Pick a day for this task first.')
  }

  const last = await prisma.task.findFirst({
    where: {
      userId: actor.userId,
      ...notDeleted,
      scheduledDate: data.scheduledDate ? isoDateToUtcDate(data.scheduledDate) : null,
    },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  // A task can only become a priority if there is room for it.
  let priorityOrder: number | null = null
  let isDailyPriority = false

  if (data.isDailyPriority && data.scheduledDate) {
    const used = await countPriorities(actor, data.scheduledDate)
    if (used < MAX_DAILY_PRIORITIES) {
      isDailyPriority = true
      priorityOrder = used
    }
  }

  const task = await prisma.task.create({
    data: {
      userId: actor.userId,
      title: data.title,
      description: data.description ?? null,
      scheduledDate: data.scheduledDate ? isoDateToUtcDate(data.scheduledDate) : null,
      scheduledTime: data.scheduledTime ?? null,
      dueDate: data.dueDate ? isoDateToUtcDate(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      category: data.category ?? null,
      priority: data.priority,
      isDailyPriority,
      priorityOrder,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    select: TASK_SELECT,
  })

  await track(actor.userId, ANALYTICS_EVENTS.TASK_CREATED, {
    hasSchedule: Boolean(data.scheduledDate),
    hasTime: Boolean(data.scheduledTime),
    isPriority: isDailyPriority,
  })

  return toTaskView(task)
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskView> {
  const data = updateTaskSchema.parse(input)

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: actor.userId, ...notDeleted },
    select: { id: true, status: true, scheduledDate: true },
  })
  if (!existing) throw new NotFoundError('Task')

  const patch: Prisma.TaskUpdateInput = {}

  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.scheduledTime !== undefined) patch.scheduledTime = data.scheduledTime
  if (data.estimatedMinutes !== undefined) patch.estimatedMinutes = data.estimatedMinutes
  if (data.category !== undefined) patch.category = data.category
  if (data.priority !== undefined) patch.priority = data.priority

  if (data.scheduledDate !== undefined) {
    patch.scheduledDate = data.scheduledDate ? isoDateToUtcDate(data.scheduledDate) : null
    // Moving a task back to the Inbox cannot leave it flagged as a priority of
    // a day it no longer belongs to.
    if (data.scheduledDate === null) {
      patch.isDailyPriority = false
      patch.priorityOrder = null
    }
  }

  if (data.dueDate !== undefined) {
    patch.dueDate = data.dueDate ? isoDateToUtcDate(data.dueDate) : null
  }

  if (data.status !== undefined) {
    patch.status = data.status
    patch.completedAt = data.status === 'COMPLETED' ? new Date() : null
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: patch,
    select: TASK_SELECT,
  })

  return toTaskView(task)
}

/**
 * Set a task's status.
 * Returns the affected local day so the caller can refresh that day's summary.
 */
export async function setTaskStatus(
  actor: Actor,
  taskId: string,
  status: TaskStatus,
): Promise<{ date: IsoDate | null; task: TaskView }> {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: actor.userId, ...notDeleted },
    select: { id: true, scheduledDate: true, isDailyPriority: true },
  })
  if (!existing) throw new NotFoundError('Task')

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
    select: TASK_SELECT,
  })

  if (status === 'COMPLETED') {
    await track(actor.userId, ANALYTICS_EVENTS.TASK_COMPLETED, {
      wasPriority: existing.isDailyPriority,
      wasScheduled: existing.scheduledDate !== null,
    })
  }

  return {
    date: existing.scheduledDate ? utcDateToIsoDate(existing.scheduledDate) : null,
    task: toTaskView(task),
  }
}

export async function deleteTask(actor: Actor, taskId: string): Promise<IsoDate | null> {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: actor.userId, ...notDeleted },
    select: { id: true, scheduledDate: true },
  })
  if (!existing) throw new NotFoundError('Task')

  await prisma.task.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })

  return existing.scheduledDate ? utcDateToIsoDate(existing.scheduledDate) : null
}

// ─── Daily priorities ────────────────────────────────────────────────────────

async function countPriorities(actor: Actor, date: IsoDate): Promise<number> {
  return prisma.task.count({
    where: {
      userId: actor.userId,
      ...notDeleted,
      scheduledDate: isoDateToUtcDate(date),
      isDailyPriority: true,
    },
  })
}

export async function listPriorities(actor: Actor, date: IsoDate): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId: actor.userId,
      ...notDeleted,
      scheduledDate: isoDateToUtcDate(date),
      isDailyPriority: true,
    },
    orderBy: [{ priorityOrder: 'asc' }, { createdAt: 'asc' }],
    select: TASK_SELECT,
  })

  return tasks.map(toTaskView)
}

/**
 * Replace the day's priorities with exactly `taskIds`, in order.
 *
 * Capped at three deliberately: the whole point is that the user is forced to
 * choose. A priority list of twenty items is just a task list.
 */
export async function setDailyPriorities(
  actor: Actor,
  date: IsoDate,
  taskIds: string[],
): Promise<TaskView[]> {
  if (taskIds.length > MAX_DAILY_PRIORITIES) {
    throw new ValidationError(
      `Choose up to ${MAX_DAILY_PRIORITIES} priorities so the day stays focused.`,
    )
  }

  const day = isoDateToUtcDate(date)

  // Only tasks that are the caller's and already on this day may be promoted.
  const owned = await prisma.task.findMany({
    where: { id: { in: taskIds }, userId: actor.userId, ...notDeleted },
    select: { id: true },
  })
  const ownedIds = new Set(owned.map((task) => task.id))
  const accepted = taskIds.filter((id) => ownedIds.has(id))

  if (accepted.length !== taskIds.length) throw new NotFoundError('Task')

  await prisma.$transaction([
    // Clear the day first so removed items lose the flag.
    prisma.task.updateMany({
      where: { userId: actor.userId, scheduledDate: day, isDailyPriority: true },
      data: { isDailyPriority: false, priorityOrder: null },
    }),
    ...accepted.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { isDailyPriority: true, priorityOrder: index, scheduledDate: day },
      }),
    ),
  ])

  await track(actor.userId, ANALYTICS_EVENTS.TASK_PRIORITISED, {
    priorityCount: accepted.length,
  })

  return listPriorities(actor, date)
}

/** Toggle a single task's priority flag, respecting the cap. */
export async function toggleDailyPriority(
  actor: Actor,
  taskId: string,
): Promise<{ isDailyPriority: boolean; date: IsoDate }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: actor.userId, ...notDeleted },
    select: { id: true, scheduledDate: true, isDailyPriority: true },
  })
  if (!task) throw new NotFoundError('Task')
  if (!task.scheduledDate) {
    throw new ValidationError('Schedule this task for a day before making it a priority.')
  }

  const date = utcDateToIsoDate(task.scheduledDate)

  if (task.isDailyPriority) {
    await prisma.task.update({
      where: { id: task.id },
      data: { isDailyPriority: false, priorityOrder: null },
    })
    return { isDailyPriority: false, date }
  }

  const used = await countPriorities(actor, date)
  if (used >= MAX_DAILY_PRIORITIES) {
    throw new ValidationError(
      `You already have ${MAX_DAILY_PRIORITIES} priorities today. Free one up first.`,
    )
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { isDailyPriority: true, priorityOrder: used },
  })

  return { isDailyPriority: true, date }
}

/** Persist a manual ordering. Ids not owned by the caller are ignored. */
export async function reorderTasks(actor: Actor, orderedIds: string[]): Promise<void> {
  const owned = await prisma.task.findMany({
    where: { id: { in: orderedIds }, userId: actor.userId, ...notDeleted },
    select: { id: true },
  })
  const ownedIds = new Set(owned.map((task) => task.id))

  await prisma.$transaction(
    orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) => prisma.task.update({ where: { id }, data: { sortOrder: index } })),
  )
}

/** Counts for the weekly review. */
export async function countTasksBetween(actor: Actor, from: IsoDate, to: IsoDate) {
  const where = {
    userId: actor.userId,
    ...notDeleted,
    scheduledDate: { gte: isoDateToUtcDate(from), lte: isoDateToUtcDate(to) },
  } satisfies Prisma.TaskWhereInput

  const [planned, completed] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: 'COMPLETED' } }),
  ])

  return { planned, completed }
}

export type { Task }
