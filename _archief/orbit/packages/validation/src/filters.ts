import { TaskView, type ItemFilter } from '@orbit/types';
import { z } from 'zod';
import {
  ideaStatusSchema,
  itemTypeSchema,
  prioritySchema,
  sortDirectionSchema,
  sortFieldSchema,
  taskStatusSchema,
} from './enums';
import { isoDateSchema, searchQuerySchema, ulidSchema } from './primitives';

export const taskViewSchema = z.nativeEnum(TaskView);

/**
 * Eén filterschema voor de takenlijst, de notitielijst, de ideeënlijst en de
 * globale zoekfunctie. De client past hetzelfde object lokaal toe, waardoor
 * offline en online exact dezelfde resultaten geven.
 */
export const itemFilterSchema: z.ZodType<ItemFilter> = z.object({
  types: z.array(itemTypeSchema).max(3).optional(),
  projectIds: z.array(ulidSchema.nullable()).max(50).optional(),
  tagIds: z.array(ulidSchema).max(50).optional(),
  tagsMatchAll: z.boolean().optional(),
  taskStatuses: z.array(taskStatusSchema).max(4).optional(),
  ideaStatuses: z.array(ideaStatusSchema).max(8).optional(),
  priorities: z.array(prioritySchema).max(5).optional(),
  folderIds: z.array(ulidSchema).max(50).optional(),
  dueFrom: isoDateSchema.nullish(),
  dueTo: isoDateSchema.nullish(),
  hasDueDate: z.boolean().optional(),
  createdFrom: isoDateSchema.nullish(),
  createdTo: isoDateSchema.nullish(),
  favorite: z.boolean().optional(),
  inInbox: z.boolean().optional(),
  archived: z.boolean().optional(),
  hasReminder: z.boolean().optional(),
  query: searchQuerySchema.optional(),
  includeSubtasks: z.boolean().optional(),
});

export const sortSpecSchema = z.object({
  field: sortFieldSchema,
  direction: sortDirectionSchema,
});

export const listItemsQuerySchema = z.object({
  filter: itemFilterSchema.optional(),
  sort: sortSpecSchema.optional(),
  cursor: z.string().max(500).nullish(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  withTotal: z.boolean().default(false),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export const searchQueryParamsSchema = z.object({
  q: searchQuerySchema,
  filter: itemFilterSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const calendarRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    includeCompleted: z.boolean().default(false),
  })
  .refine((range) => range.from <= range.to, {
    path: ['to'],
    message: 'De einddatum ligt voor de startdatum',
  })
  .refine(
    (range) => {
      const days =
        (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000;
      return days <= 400;
    },
    { path: ['to'], message: 'Het bereik mag maximaal 400 dagen beslaan' },
  );

export type CalendarRangeQuery = z.infer<typeof calendarRangeSchema>;
