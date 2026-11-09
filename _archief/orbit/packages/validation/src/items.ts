import { ItemType } from '@orbit/types';
import { z } from 'zod';
import {
  captureSourceSchema,
  ideaStatusSchema,
  itemTypeSchema,
  prioritySchema,
  taskStatusSchema,
} from './enums';
import { noteContentSchema } from './note-content';
import {
  LIMITS,
  isoDateSchema,
  isoTimeSchema,
  sortKeySchema,
  titleSchema,
  ulidSchema,
  urlSchema,
} from './primitives';
import { recurrenceRuleSchema } from './recurrence';

/**
 * Ids mogen door de client worden aangeleverd: dat is wat offline aanmaken
 * mogelijk maakt. De server accepteert het id maar controleert dat het nog
 * niet bestaat binnen de workspace.
 */
const clientIdSchema = ulidSchema.optional();

export const checklistItemSchema = z.object({
  id: clientIdSchema,
  text: z.string().trim().min(1).max(LIMITS.checklistTextMax),
  done: z.boolean().optional(),
  sortKey: sortKeySchema.optional(),
});

const sharedItemFields = {
  id: clientIdSchema,
  title: titleSchema,
  projectId: ulidSchema.nullish(),
  tagIds: z.array(ulidSchema).max(LIMITS.tagsPerItemMax).optional(),
  inInbox: z.boolean().optional(),
  favorite: z.boolean().optional(),
  sortKey: sortKeySchema.optional(),
  capturedVia: captureSourceSchema.optional(),
  /**
   * Een checklist mag meteen bij het aanmaken mee. Een taak omzetten vanuit een
   * notitie levert er direct een op, en dan is een tweede request zonde.
   */
  checklist: z.array(checklistItemSchema).max(LIMITS.checklistMax).optional(),
};

export const taskDetailInputSchema = z.object({
  description: z.string().max(LIMITS.descriptionMax).nullish(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: isoDateSchema.nullish(),
  dueTime: isoTimeSchema.nullish(),
  startDate: isoDateSchema.nullish(),
  estimateMinutes: z.number().int().min(1).max(60 * 24 * 30).nullish(),
  recurrence: recurrenceRuleSchema.nullish(),
  parentTaskId: ulidSchema.nullish(),
});

export const noteDetailInputSchema = z.object({
  content: noteContentSchema.optional(),
  folderId: ulidSchema.nullish(),
  pinned: z.boolean().optional(),
});

export const ideaDetailInputSchema = z.object({
  description: z.string().max(LIMITS.descriptionMax).nullish(),
  category: z.string().trim().max(80).nullish(),
  status: ideaStatusSchema.optional(),
  impact: z.number().int().min(1).max(5).nullish(),
  effort: z.number().int().min(1).max(5).nullish(),
  sourceUrl: urlSchema.nullish(),
});

export const createItemSchema = z
  .discriminatedUnion('type', [
    z.object({
      ...sharedItemFields,
      type: z.literal(ItemType.Task),
      task: taskDetailInputSchema.optional(),
    }),
    z.object({
      ...sharedItemFields,
      type: z.literal(ItemType.Note),
      note: noteDetailInputSchema.optional(),
    }),
    z.object({
      ...sharedItemFields,
      type: z.literal(ItemType.Idea),
      idea: ideaDetailInputSchema.optional(),
    }),
  ])
  .superRefine((input, ctx) => {
    if (input.type === ItemType.Task && input.task?.dueTime && !input.task.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['task', 'dueTime'],
        message: 'Een tijd heeft ook een datum nodig',
      });
    }
    if (
      input.type === ItemType.Task &&
      input.task?.startDate &&
      input.task.dueDate &&
      input.task.startDate > input.task.dueDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['task', 'startDate'],
        message: 'De startdatum ligt na de deadline',
      });
    }
    if (input.type === ItemType.Task && input.task?.recurrence && !input.task.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['task', 'recurrence'],
        message: 'Een herhalende taak heeft een startdatum nodig',
      });
    }
  });

export type CreateItemInput = z.infer<typeof createItemSchema>;

/** Patch. Alleen de meegestuurde velden worden gewijzigd; `null` wist een veld. */
export const updateItemSchema = z.object({
  title: titleSchema.optional(),
  projectId: ulidSchema.nullish(),
  inInbox: z.boolean().optional(),
  favorite: z.boolean().optional(),
  sortKey: sortKeySchema.optional(),
  archived: z.boolean().optional(),
  tagIds: z.array(ulidSchema).max(LIMITS.tagsPerItemMax).optional(),
  task: taskDetailInputSchema.partial().optional(),
  note: noteDetailInputSchema.partial().optional(),
  idea: ideaDetailInputSchema.partial().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Conversie tussen types. Het item behoudt zijn id, tags, bijlagen en historie;
 * alleen het detailrecord wisselt. Zie ARCHITECTURE.md §2.
 */
export const convertItemSchema = z
  .object({
    targetType: itemTypeSchema,
    /** Extra velden die alleen bij het doeltype bestaan. */
    task: taskDetailInputSchema.optional(),
    note: noteDetailInputSchema.optional(),
    idea: ideaDetailInputSchema.optional(),
    /** Bewaart een DERIVED_FROM-link naar het origineel. Standaard aan. */
    keepBacklink: z.boolean().default(true),
  })
  .refine(
    (input) =>
      (input.targetType === ItemType.Task && !input.note && !input.idea) ||
      (input.targetType === ItemType.Note && !input.task && !input.idea) ||
      (input.targetType === ItemType.Idea && !input.task && !input.note),
    { message: 'De meegegeven details passen niet bij het doeltype' },
  );

export type ConvertItemInput = z.infer<typeof convertItemSchema>;

/** Een idee promoveren tot volwaardig project, inclusief startaken. */
export const promoteIdeaToProjectSchema = z.object({
  projectName: z.string().trim().min(1).max(LIMITS.projectNameMax).optional(),
  copyTags: z.boolean().default(true),
  /** Titels van taken die meteen in het nieuwe project worden gezet. */
  initialTasks: z.array(titleSchema).max(50).default([]),
});

export type PromoteIdeaToProjectInput = z.infer<typeof promoteIdeaToProjectSchema>;

export const completeTaskSchema = z.object({
  completed: z.boolean(),
  /** Moment van afvinken; de client stuurt dit mee zodat offline afvinken klopt. */
  completedAt: z.string().datetime({ offset: false }).optional(),
});

export const replaceChecklistSchema = z.object({
  items: z.array(checklistItemSchema).max(LIMITS.checklistMax),
});

export const bulkItemActionSchema = z.object({
  itemIds: z.array(ulidSchema).min(1).max(500),
  action: z.enum([
    'ARCHIVE',
    'UNARCHIVE',
    'DELETE',
    'RESTORE',
    'COMPLETE',
    'REOPEN',
    'FAVORITE',
    'UNFAVORITE',
    'MOVE_TO_PROJECT',
    'ADD_TAG',
    'REMOVE_TAG',
    'SET_PRIORITY',
    'SET_DUE_DATE',
  ]),
  projectId: ulidSchema.nullish(),
  tagId: ulidSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: isoDateSchema.nullish(),
});

export type BulkItemActionInput = z.infer<typeof bulkItemActionSchema>;

export const reorderItemSchema = z.object({
  beforeId: ulidSchema.nullish(),
  afterId: ulidSchema.nullish(),
});
