import { z } from 'zod';

/**
 * The command schema is the contract between every part of the intent engine:
 * deterministic parser, LLM parser, validator, UI preview and action router.
 * Nothing is executed unless it validates against `CommandSchema`.
 */

export const INTENTS = [
  'CAPTURE_NOTE',
  'CAPTURE_IDEA',
  'CREATE_TASK',
  'CREATE_REMINDER',
  'CREATE_CALENDAR_EVENT',
  'CREATE_ALARM',
  'CREATE_TIMER',
  'UPDATE_TASK',
  'COMPLETE_TASK',
  'UPDATE_EVENT',
  'DELETE_EVENT',
  'SEARCH_NOTES',
  'GET_AGENDA',
  'GET_TASKS',
  'BUTLER_TOOL',
  'UNKNOWN',
] as const;

export type AssistantIntent = (typeof INTENTS)[number];
export const IntentSchema = z.enum(INTENTS);

export const LanguageSchema = z.enum(['nl', 'en', 'fr']);
export const InputSourceSchema = z.enum(['voice', 'text', 'siri', 'shortcut', 'widget', 'notification', 'share']);
export const ParserSourceSchema = z.enum(['deterministic', 'llm', 'context', 'manual']);

export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const ClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const RecurrenceSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().positive(),
  byWeekday: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)])).optional(),
  bySetPosition: z.number().int().optional(),
  until: ISODateSchema.optional(),
});

/** A resolved point or span in time. Always in the device timezone; `phrase` keeps what the user said. */
export const WhenSchema = z.object({
  date: ISODateSchema.nullable(),
  time: ClockTimeSchema.nullable(),
  endDate: ISODateSchema.nullable(),
  endTime: ClockTimeSchema.nullable(),
  iso: z.string().nullable(),
  endIso: z.string().nullable(),
  timezone: z.string().min(1),
  hasExplicitDate: z.boolean(),
  hasExplicitTime: z.boolean(),
  recurrence: RecurrenceSchema.nullable(),
  phrase: z.string().nullable(),
});
export type When = z.infer<typeof WhenSchema>;

export const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;

export const AlertSchema = z.object({ offsetMinutes: z.number().int() });

const Base = z.object({
  id: z.string().min(1),
  intent: IntentSchema,
  /** 0–1. Thresholds in `EngineConfig` decide execute / confirm / clarify. */
  confidence: z.number().min(0).max(1),
  language: LanguageSchema,
  /** The clause of the input this command was derived from. */
  originalText: z.string(),
  requiresConfirmation: z.boolean(),
  missingFields: z.array(z.string()),
  clarificationQuestion: z.string().nullable(),
  parser: ParserSourceSchema,
  warnings: z.array(z.string()),
});

const TitleSchema = z.string().min(1).max(200);
const TagsSchema = z.array(z.string().min(1).max(40));
const PeopleSchema = z.array(z.string().min(1).max(80));

export const CaptureNoteCommandSchema = Base.extend({
  intent: z.literal('CAPTURE_NOTE'),
  title: TitleSchema,
  content: z.string().min(1),
  category: z.string().nullable(),
  tags: TagsSchema,
  people: PeopleSchema,
  noteType: z.enum(['NOTE', 'THOUGHT', 'QUESTION', 'REFERENCE']),
});

export const CaptureIdeaCommandSchema = Base.extend({
  intent: z.literal('CAPTURE_IDEA'),
  title: TitleSchema,
  content: z.string().min(1),
  category: z.string().nullable(),
  tags: TagsSchema,
  people: PeopleSchema,
});

export const CreateTaskCommandSchema = Base.extend({
  intent: z.literal('CREATE_TASK'),
  title: TitleSchema,
  description: z.string().nullable(),
  when: WhenSchema.nullable(),
  priority: PrioritySchema,
  category: z.string().nullable(),
  tags: TagsSchema,
  people: PeopleSchema,
  /** e.g. "shopping" when the user said "add milk to my shopping list". */
  listName: z.string().nullable(),
});

export const CreateReminderCommandSchema = Base.extend({
  intent: z.literal('CREATE_REMINDER'),
  title: TitleSchema,
  when: WhenSchema.nullable(),
  notes: z.string().nullable(),
  people: PeopleSchema,
});

export const CreateCalendarEventCommandSchema = Base.extend({
  intent: z.literal('CREATE_CALENDAR_EVENT'),
  title: TitleSchema,
  when: WhenSchema.nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  people: PeopleSchema,
  alerts: z.array(AlertSchema),
  allDay: z.boolean(),
});

export const CreateAlarmCommandSchema = Base.extend({
  intent: z.literal('CREATE_ALARM'),
  when: WhenSchema.nullable(),
  label: z.string().nullable(),
});

export const CreateTimerCommandSchema = Base.extend({
  intent: z.literal('CREATE_TIMER'),
  durationSeconds: z.number().int().positive().nullable(),
  label: z.string().nullable(),
});

export const TaskChangesSchema = z.object({
  title: TitleSchema.optional(),
  when: WhenSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  status: z.enum(['open', 'done', 'someday']).optional(),
});

export const UpdateTaskCommandSchema = Base.extend({
  intent: z.literal('UPDATE_TASK'),
  /** Free-text description of the task to change ("my call with Youssef"). */
  targetQuery: z.string().min(1),
  changes: TaskChangesSchema,
});

export const CompleteTaskCommandSchema = Base.extend({
  intent: z.literal('COMPLETE_TASK'),
  targetQuery: z.string().min(1),
});

export const EventChangesSchema = z.object({
  title: TitleSchema.optional(),
  when: WhenSchema.nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  location: z.string().optional(),
});

export const UpdateEventCommandSchema = Base.extend({
  intent: z.literal('UPDATE_EVENT'),
  targetQuery: z.string().min(1),
  changes: EventChangesSchema,
});

export const DeleteEventCommandSchema = Base.extend({
  intent: z.literal('DELETE_EVENT'),
  targetQuery: z.string().min(1),
  when: WhenSchema.nullable(),
});

export const SearchTypesSchema = z.array(z.enum(['NOTE', 'IDEA', 'THOUGHT', 'TASK', 'REMINDER', 'EVENT', 'QUESTION', 'REFERENCE', 'VOICE_CAPTURE']));

export const SearchNotesCommandSchema = Base.extend({
  intent: z.literal('SEARCH_NOTES'),
  query: z.string().min(1),
  filters: z.object({
    from: ISODateSchema.nullable(),
    to: ISODateSchema.nullable(),
    category: z.string().nullable(),
    person: z.string().nullable(),
    types: SearchTypesSchema,
  }),
});

export const GetAgendaCommandSchema = Base.extend({
  intent: z.literal('GET_AGENDA'),
  when: WhenSchema.nullable(),
  /** Number of days to include starting from `when.date` (default 1). */
  rangeDays: z.number().int().positive(),
});

export const GetTasksCommandSchema = Base.extend({
  intent: z.literal('GET_TASKS'),
  when: WhenSchema.nullable(),
  filter: z.enum(['today', 'tomorrow', 'date', 'upcoming', 'overdue', 'all', 'someday']),
});

export const UnknownCommandSchema = Base.extend({
  intent: z.literal('UNKNOWN'),
  text: z.string(),
});

export const ToolPermissionSchema = z.enum(['read', 'write', 'sensitive', 'external']);

/**
 * A Butler capability (spec §138): the tool name, its validated arguments, the
 * permission level that decides confirmation/audit, and the preview shown on the card.
 * The ActionRouter executes it through the ToolRegistry.
 */
export const ButlerToolCommandSchema = Base.extend({
  intent: z.literal('BUTLER_TOOL'),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  permission: ToolPermissionSchema,
  preview: z.object({ label: z.string(), title: z.string(), lines: z.array(z.string()) }),
});

export const CommandSchema = z.discriminatedUnion('intent', [
  CaptureNoteCommandSchema,
  CaptureIdeaCommandSchema,
  CreateTaskCommandSchema,
  CreateReminderCommandSchema,
  CreateCalendarEventCommandSchema,
  CreateAlarmCommandSchema,
  CreateTimerCommandSchema,
  UpdateTaskCommandSchema,
  CompleteTaskCommandSchema,
  UpdateEventCommandSchema,
  DeleteEventCommandSchema,
  SearchNotesCommandSchema,
  GetAgendaCommandSchema,
  GetTasksCommandSchema,
  ButlerToolCommandSchema,
  UnknownCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;
export type CommandOf<I extends AssistantIntent> = Extract<Command, { intent: I }>;

export const CommandBatchSchema = z.object({
  id: z.string().min(1),
  commands: z.array(CommandSchema).min(1),
  originalText: z.string(),
  transcript: z.string().nullable(),
  language: LanguageSchema,
  source: InputSourceSchema,
  createdAt: z.string(),
});
export type CommandBatch = z.infer<typeof CommandBatchSchema>;

/** Intents whose execution never destroys or changes existing data. */
export const SAFE_INTENTS: readonly AssistantIntent[] = [
  'CAPTURE_NOTE',
  'CAPTURE_IDEA',
  'CREATE_TASK',
  'CREATE_REMINDER',
  'CREATE_CALENDAR_EVENT',
  'CREATE_ALARM',
  'CREATE_TIMER',
  'SEARCH_NOTES',
  'GET_AGENDA',
  'GET_TASKS',
];

/** Intents that must always be confirmed by the user. */
export const DESTRUCTIVE_INTENTS: readonly AssistantIntent[] = ['DELETE_EVENT', 'UPDATE_EVENT', 'UPDATE_TASK', 'COMPLETE_TASK'];

/** Read-only intents: they answer a question instead of creating something. */
export const QUERY_INTENTS: readonly AssistantIntent[] = ['SEARCH_NOTES', 'GET_AGENDA', 'GET_TASKS'];

export function isQueryIntent(intent: AssistantIntent): boolean {
  return QUERY_INTENTS.includes(intent);
}

export function isDestructiveIntent(intent: AssistantIntent): boolean {
  return DESTRUCTIVE_INTENTS.includes(intent);
}

export function isSafeIntent(intent: AssistantIntent): boolean {
  return SAFE_INTENTS.includes(intent);
}

/** Commands that may run without a confirmation card: safe intents, or read-only Butler tools. */
export function isAutoExecutable(command: Command, allowedIntents: readonly AssistantIntent[]): boolean {
  if (command.requiresConfirmation) return false;
  if (command.intent === 'BUTLER_TOOL') return command.permission === 'read';
  return !isDestructiveIntent(command.intent) && allowedIntents.includes(command.intent);
}

/** Validates unknown data as a command; returns the issues instead of throwing. */
export function parseCommand(data: unknown): { success: true; command: Command } | { success: false; issues: string[] } {
  const result = CommandSchema.safeParse(data);
  if (result.success) return { success: true, command: result.data };
  return { success: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
