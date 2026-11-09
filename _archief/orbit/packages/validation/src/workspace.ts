import { z } from 'zod';
import {
  memberRoleSchema,
  prioritySchema,
  projectStatusSchema,
  reminderChannelSchema,
} from './enums';
import {
  LIMITS,
  hexColorSchema,
  isoDateSchema,
  isoDateTimeSchema,
  sortKeySchema,
  ulidSchema,
} from './primitives';

export const createProjectSchema = z
  .object({
    id: ulidSchema.optional(),
    name: z.string().trim().min(1).max(LIMITS.projectNameMax),
    description: z.string().max(LIMITS.descriptionMax).nullish(),
    color: hexColorSchema.optional(),
    icon: z.string().max(32).nullish(),
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    startDate: isoDateSchema.nullish(),
    endDate: isoDateSchema.nullish(),
    favorite: z.boolean().optional(),
    sortKey: sortKeySchema.optional(),
    tagIds: z.array(ulidSchema).max(LIMITS.tagsPerItemMax).optional(),
  })
  .refine(
    (input) => !input.startDate || !input.endDate || input.startDate <= input.endDate,
    { path: ['endDate'], message: 'De einddatum ligt voor de startdatum' },
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.projectNameMax).optional(),
  description: z.string().max(LIMITS.descriptionMax).nullish(),
  color: hexColorSchema.optional(),
  icon: z.string().max(32).nullish(),
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  startDate: isoDateSchema.nullish(),
  endDate: isoDateSchema.nullish(),
  favorite: z.boolean().optional(),
  sortKey: sortKeySchema.optional(),
  archived: z.boolean().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createTagSchema = z.object({
  id: ulidSchema.optional(),
  name: z.string().trim().min(1).max(LIMITS.tagNameMax),
  color: hexColorSchema.optional(),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.tagNameMax).optional(),
  color: hexColorSchema.optional(),
});

/** Twee tags samenvoegen; alle koppelingen verhuizen naar de doeltag. */
export const mergeTagsSchema = z.object({
  sourceTagId: ulidSchema,
  targetTagId: ulidSchema,
});

export const createNoteFolderSchema = z.object({
  id: ulidSchema.optional(),
  name: z.string().trim().min(1).max(LIMITS.folderNameMax),
  parentId: ulidSchema.nullish(),
  icon: z.string().max(32).nullish(),
  color: hexColorSchema.nullish(),
  sortKey: sortKeySchema.optional(),
});

export const updateNoteFolderSchema = createNoteFolderSchema
  .omit({ id: true })
  .partial();

export const createReminderSchema = z
  .object({
    id: ulidSchema.optional(),
    itemId: ulidSchema,
    /** Absoluut moment. Precies één van `remindAt` of `offsetMinutes` is gezet. */
    remindAt: isoDateTimeSchema.optional(),
    /** Minuten vóór de deadline: 10, 60, 1440, of een eigen waarde. */
    offsetMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
    channel: reminderChannelSchema.optional(),
  })
  .refine(
    (input) => Boolean(input.remindAt) !== Boolean(input.offsetMinutes !== undefined),
    { message: 'Geef een absoluut moment of een offset, niet allebei' },
  );

export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const REMINDER_PRESETS = [
  { labelKey: 'atTime', offsetMinutes: 0 },
  { labelKey: 'tenMinutes', offsetMinutes: 10 },
  { labelKey: 'thirtyMinutes', offsetMinutes: 30 },
  { labelKey: 'oneHour', offsetMinutes: 60 },
  { labelKey: 'oneDay', offsetMinutes: 1440 },
  { labelKey: 'oneWeek', offsetMinutes: 10_080 },
] as const;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().max(LIMITS.emailMax),
  role: memberRoleSchema,
});
