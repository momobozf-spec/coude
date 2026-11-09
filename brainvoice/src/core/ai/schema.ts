import { z } from 'zod';

import { IntentSchema, LanguageSchema, PrioritySchema, SearchTypesSchema } from '../intent/schema';

/**
 * What the LLM is allowed to return. Dates are *phrases*, never absolute values:
 * the LLMParser resolves every phrase locally with the DateResolver.
 * `isoDate` / `isoTime` are optional hints that are only used when the phrase
 * cannot be resolved locally, and then only after a plausibility check.
 */

export const AIWhenSchema = z.object({
  phrase: z.string().min(1).describe('The date/time words exactly as the user said them, e.g. "tomorrow at 8", "vrijdag om 14 uur"'),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Optional hint YYYY-MM-DD; the app re-computes dates locally'),
  isoTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe('Optional hint HH:mm (24h)'),
  endPhrase: z.string().nullable().optional().describe('End time words if a range was given, e.g. "until 8"'),
});

export const AICommandSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  people: z.array(z.string()).nullable().optional(),
  when: AIWhenSchema.nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  alerts: z.array(z.object({ offsetMinutes: z.number() })).nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  priority: PrioritySchema.nullable().optional(),
  listName: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  targetQuery: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  searchTypes: SearchTypesSchema.nullable().optional(),
  searchPerson: z.string().nullable().optional(),
  changeWhen: AIWhenSchema.nullable().optional().describe('For UPDATE_* intents: the new date/time phrase'),
  changeTitle: z.string().nullable().optional(),
  missingFields: z.array(z.string()).nullable().optional(),
  clarificationQuestion: z.string().nullable().optional(),
  /** For intent BUTLER_TOOL: the tool name from the catalog and its arguments. Date args end in "Phrase" and are resolved locally. */
  tool: z.string().nullable().optional(),
  toolArgs: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const AIParseOutputSchema = z.object({
  language: LanguageSchema.nullable().optional(),
  commands: z.array(AICommandSchema).max(10),
  clarificationQuestion: z.string().nullable().optional(),
});

export type AICommand = z.infer<typeof AICommandSchema>;
export type AIParseOutput = z.infer<typeof AIParseOutputSchema>;

/** JSON Schema for the API's structured output. Generated from the Zod schema so both stay in sync. */
export function aiParseJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(AIParseOutputSchema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
}
