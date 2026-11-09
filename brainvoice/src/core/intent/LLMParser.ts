import { DateTime } from 'luxon';

import { classifyText, suggestTitle } from './Classifier';
import { toWhen } from './DeterministicParser';
import type { Command, CommandBatch, CommandOf, When } from './schema';
import type { AIParseContext, AIProvider } from '../ai/AIProvider';
import type { AICommand, AIWhenSchema } from '../ai/schema';
import { buildToolCommand } from '../butler/AdminParser';
import { type DateResolver, dateResolver as defaultResolver, type ResolveContext } from '../date/DateResolver';
import type { InputSource, Language } from '../types/common';
import { newId } from '../util/id';
import { sentenceCase } from '../util/text';
import type { z } from 'zod';

/**
 * LLMParser – turns validated AI output into commands.
 * Every date phrase is resolved locally; the model's ISO hints are used only
 * when local resolution fails and the hint is plausible (not in the past by
 * more than a day, not more than two years ahead).
 */

export interface LLMParseInput {
  text: string;
  language: Language;
  now: DateTime;
  timezone: string;
  source: InputSource;
  transcript?: string | null;
  categories: string[];
  pendingQuestion?: string | null;
  lastCommandSummary?: string | null;
}

type AIWhen = z.infer<typeof AIWhenSchema>;

export class LLMParser {
  constructor(
    private readonly provider: AIProvider,
    private readonly resolver: DateResolver = defaultResolver,
  ) {}

  async parse(input: LLMParseInput): Promise<CommandBatch | null> {
    const ctx: AIParseContext = {
      language: input.language,
      nowISO: input.now.setZone(input.timezone).toISO({ suppressMilliseconds: true }) ?? new Date().toISOString(),
      timezone: input.timezone,
      categories: input.categories,
      pendingQuestion: input.pendingQuestion ?? null,
      lastCommandSummary: input.lastCommandSummary ?? null,
    };
    const output = await this.provider.parseCommand(input.text, ctx);
    const language = output.language ?? input.language;
    const commands: Command[] = [];
    for (const ai of output.commands) {
      const cmd = this.toCommand(ai, input, language);
      if (cmd) commands.push(cmd);
    }
    if (commands.length === 0) return null;
    return {
      id: newId(),
      commands,
      originalText: input.text,
      transcript: input.transcript ?? null,
      language,
      source: input.source,
      createdAt: input.now.toISO() ?? new Date().toISOString(),
    };
  }

  private rc(input: LLMParseInput, language: Language, intent: string): ResolveContext {
    return {
      now: input.now,
      timezone: input.timezone,
      language,
      timePolicy: intent === 'CREATE_ALARM' ? 'morning' : 'business',
      preferFuture: intent !== 'SEARCH_NOTES',
    };
  }

  private resolveWhen(aiWhen: AIWhen | null | undefined, input: LLMParseInput, language: Language, intent: string): { when: When | null; warnings: string[] } {
    if (!aiWhen) return { when: null, warnings: [] };
    const warnings: string[] = [];
    const phrase = aiWhen.endPhrase ? `${aiWhen.phrase} ${aiWhen.endPhrase}` : aiWhen.phrase;
    const res = this.resolver.resolve(phrase, this.rc(input, language, intent));
    if (res && (res.date || res.time)) return { when: toWhen(res, input.timezone), warnings };
    // Fallback to hints with plausibility checks – never trust blindly.
    if (aiWhen.isoDate) {
      const dt = DateTime.fromISO(aiWhen.isoTime ? `${aiWhen.isoDate}T${aiWhen.isoTime}` : `${aiWhen.isoDate}T09:00`, { zone: input.timezone });
      const now = input.now.setZone(input.timezone);
      if (dt.isValid && dt > now.minus({ days: 1 }) && dt < now.plus({ years: 2 })) {
        warnings.push('LLM_DATE_HINT');
        return {
          when: {
            date: aiWhen.isoDate,
            time: aiWhen.isoTime ?? null,
            endDate: null,
            endTime: null,
            iso: aiWhen.isoTime ? dt.toISO({ suppressMilliseconds: true }) : null,
            endIso: null,
            timezone: input.timezone,
            hasExplicitDate: true,
            hasExplicitTime: Boolean(aiWhen.isoTime),
            recurrence: null,
            phrase: aiWhen.phrase,
          },
          warnings,
        };
      }
      warnings.push('LLM_DATE_REJECTED');
    }
    return { when: null, warnings };
  }

  private toCommand(ai: AICommand, input: LLMParseInput, language: Language): Command | null {
    const confidence = Math.max(0, Math.min(1, ai.confidence));
    const base = {
      id: newId(),
      language,
      originalText: input.text,
      parser: 'llm' as const,
      requiresConfirmation: true,
      missingFields: ai.missingFields ?? [],
      clarificationQuestion: ai.clarificationQuestion ?? null,
      warnings: [] as string[],
    };
    const people = ai.people ?? [];
    const tags = (ai.tags ?? []).map((tg) => tg.toLowerCase());
    const title = ai.title ? sentenceCase(ai.title) : '';
    const content = ai.content ?? ai.title ?? '';
    const lowerConfidence = (w: string[]) => (w.includes('LLM_DATE_HINT') ? Math.min(confidence, 0.8) : confidence);

    switch (ai.intent) {
      case 'CAPTURE_NOTE': {
        if (!content) return null;
        const cls = classifyText(content, { people });
        return { ...base, intent: 'CAPTURE_NOTE', confidence, title: title || suggestTitle(content, language), content, category: ai.category ?? (cls.category === 'Uncategorized' ? null : cls.category), tags: tags.length ? tags : cls.tags, people, noteType: 'NOTE' };
      }
      case 'CAPTURE_IDEA': {
        if (!content) return null;
        const cls = classifyText(content, { isIdea: true, people });
        return { ...base, intent: 'CAPTURE_IDEA', confidence, title: title || suggestTitle(content, language), content, category: ai.category ?? cls.category, tags: tags.length ? tags : cls.tags, people };
      }
      case 'CREATE_TASK': {
        const { when, warnings } = this.resolveWhen(ai.when, input, language, ai.intent);
        return { ...base, warnings, intent: 'CREATE_TASK', confidence: lowerConfidence(warnings), title: title || sentenceCase(content) || 'Task', description: ai.notes ?? null, when, priority: ai.priority ?? 'normal', category: ai.category ?? null, tags, people, listName: ai.listName ?? null };
      }
      case 'CREATE_REMINDER': {
        const { when, warnings } = this.resolveWhen(ai.when, input, language, ai.intent);
        return { ...base, warnings, intent: 'CREATE_REMINDER', confidence: lowerConfidence(warnings), title: title || sentenceCase(content) || 'Reminder', when, notes: ai.notes ?? null, people };
      }
      case 'CREATE_CALENDAR_EVENT': {
        const { when, warnings } = this.resolveWhen(ai.when, input, language, ai.intent);
        return {
          ...base,
          warnings,
          intent: 'CREATE_CALENDAR_EVENT',
          confidence: lowerConfidence(warnings),
          title: title || sentenceCase(content) || 'Event',
          when,
          durationMinutes: ai.durationMinutes && ai.durationMinutes > 0 ? Math.round(ai.durationMinutes) : null,
          location: ai.location ?? null,
          notes: ai.notes ?? null,
          people,
          alerts: (ai.alerts ?? []).map((a) => ({ offsetMinutes: Math.round(a.offsetMinutes) })),
          allDay: Boolean(when && when.date && !when.time),
        };
      }
      case 'CREATE_ALARM': {
        const { when, warnings } = this.resolveWhen(ai.when, input, language, ai.intent);
        return { ...base, warnings, intent: 'CREATE_ALARM', confidence: lowerConfidence(warnings), when, label: ai.label ?? (title || null) };
      }
      case 'CREATE_TIMER': {
        const seconds = ai.durationMinutes && ai.durationMinutes > 0 ? Math.round(ai.durationMinutes * 60) : null;
        return { ...base, intent: 'CREATE_TIMER', confidence, durationSeconds: seconds, label: ai.label ?? (title || null) };
      }
      case 'UPDATE_TASK': {
        const { when, warnings } = this.resolveWhen(ai.changeWhen ?? ai.when, input, language, ai.intent);
        const changes: CommandOf<'UPDATE_TASK'>['changes'] = {};
        if (when) changes.when = when;
        if (ai.changeTitle) changes.title = sentenceCase(ai.changeTitle);
        if (ai.priority) changes.priority = ai.priority;
        return { ...base, warnings, intent: 'UPDATE_TASK', confidence: lowerConfidence(warnings), targetQuery: ai.targetQuery ?? title ?? input.text, changes };
      }
      case 'COMPLETE_TASK':
        return { ...base, intent: 'COMPLETE_TASK', confidence, targetQuery: ai.targetQuery ?? title ?? input.text };
      case 'UPDATE_EVENT': {
        const { when, warnings } = this.resolveWhen(ai.changeWhen ?? ai.when, input, language, ai.intent);
        const changes: CommandOf<'UPDATE_EVENT'>['changes'] = {};
        if (when) changes.when = when;
        if (ai.changeTitle) changes.title = sentenceCase(ai.changeTitle);
        if (ai.durationMinutes && ai.durationMinutes > 0) changes.durationMinutes = Math.round(ai.durationMinutes);
        if (ai.location) changes.location = ai.location;
        return { ...base, warnings, intent: 'UPDATE_EVENT', confidence: lowerConfidence(warnings), targetQuery: ai.targetQuery ?? title ?? input.text, changes };
      }
      case 'DELETE_EVENT': {
        const { when, warnings } = this.resolveWhen(ai.when, input, language, ai.intent);
        return { ...base, warnings, intent: 'DELETE_EVENT', confidence, targetQuery: ai.targetQuery ?? title ?? input.text, when };
      }
      case 'SEARCH_NOTES': {
        const { when } = this.resolveWhen(ai.when, input, language, ai.intent);
        return {
          ...base,
          intent: 'SEARCH_NOTES',
          confidence,
          query: ai.query ?? title ?? input.text,
          filters: { from: when?.date ?? null, to: when?.endDate ?? when?.date ?? null, category: ai.category ?? null, person: ai.searchPerson ?? people[0] ?? null, types: ai.searchTypes ?? [] },
        };
      }
      case 'GET_AGENDA': {
        const { when } = this.resolveWhen(ai.when, input, language, ai.intent);
        return { ...base, intent: 'GET_AGENDA', confidence, when, rangeDays: 1 };
      }
      case 'GET_TASKS': {
        const { when } = this.resolveWhen(ai.when, input, language, ai.intent);
        const today = input.now.setZone(input.timezone).toISODate();
        const tomorrow = input.now.setZone(input.timezone).plus({ days: 1 }).toISODate();
        const filter: CommandOf<'GET_TASKS'>['filter'] = when?.date === tomorrow ? 'tomorrow' : when?.date && when.date !== today ? 'date' : 'today';
        return { ...base, intent: 'GET_TASKS', confidence, when, filter };
      }
      case 'BUTLER_TOOL': {
        if (!ai.tool) return { ...base, intent: 'UNKNOWN', confidence: Math.min(confidence, 0.4), text: input.text };
        const args = this.resolveToolDates(ai.toolArgs ?? {}, input, language);
        const command = buildToolCommand({ tool: ai.tool, args, language, originalText: input.text, confidence: Math.min(confidence, 0.9), parser: 'llm' });
        if (!command) return { ...base, intent: 'UNKNOWN', confidence: Math.min(confidence, 0.4), text: input.text };
        return { ...command, missingFields: ai.missingFields ?? [], clarificationQuestion: ai.clarificationQuestion ?? null };
      }
      case 'UNKNOWN':
      default:
        return { ...base, intent: 'UNKNOWN', confidence: Math.min(confidence, 0.4), text: input.text };
    }
  }

  /** "dueDatePhrase": "next Friday" → "dueDate": "2026-10-09" (resolved locally, never by the model). */
  private resolveToolDates(args: Record<string, unknown>, input: LLMParseInput, language: Language): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key.endsWith('Phrase') && typeof value === 'string') {
        const target = key.slice(0, -'Phrase'.length);
        const res = this.resolver.resolve(value, this.rc(input, language, 'BUTLER_TOOL'));
        if (res?.date) out[target] = res.date;
        continue;
      }
      out[key] = value;
    }
    return out;
  }
}
