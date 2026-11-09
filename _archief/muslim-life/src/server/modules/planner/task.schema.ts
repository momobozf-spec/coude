import { z } from 'zod'

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export const TASK_CATEGORIES = [
  'PERSONAL',
  'WORK',
  'FAMILY',
  'HEALTH',
  'LEARNING',
  'ERRAND',
  'WORSHIP',
  'OTHER',
] as const

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date.')

export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Expected a HH:mm time.')

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Give the task a title.').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  /** `null` puts the task in the Inbox. */
  scheduledDate: isoDateSchema.nullable().optional(),
  scheduledTime: clockTimeSchema.nullable().optional(),
  dueDate: isoDateSchema.nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  category: z.enum(TASK_CATEGORIES).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
  isDailyPriority: z.boolean().default(false),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ status: z.enum(TASK_STATUSES).optional() })

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

export const taskIdSchema = z.string().uuid()

export const reorderTasksSchema = z.object({
  /** Task ids in their new order. */
  orderedIds: z.array(z.string().uuid()).max(200),
})

export const setPrioritiesSchema = z.object({
  date: isoDateSchema,
  /** Ordered task ids to mark as the day's priorities. */
  taskIds: z.array(z.string().uuid()).max(10),
})
