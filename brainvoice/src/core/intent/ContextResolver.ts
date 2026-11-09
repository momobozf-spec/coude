import { DateTime } from 'luxon';

import { toWhen } from './DeterministicParser';
import type { Command, CommandBatch, When } from './schema';
import type { ButlerFocus } from '../butler/focus';
import { type DateResolver, dateResolver as defaultResolver, type ResolveContext } from '../date/DateResolver';
import type { Language } from '../types/common';
import { newId } from '../util/id';
import { normalizeText, sentenceCase, trimPunctuation } from '../util/text';

/**
 * ContextResolver – conversational memory for follow-ups.
 *
 *  1. Clarification answers: the engine asked "When?" and the user says "Friday morning".
 *  2. Modifications: "Make that 3 instead." refers to the last proposed/executed command.
 *
 * State is a plain serialisable object persisted by ContextService (SQLite).
 */

export interface PendingClarification {
  batch: CommandBatch;
  commandId: string;
  field: string;
  question: string;
  createdAt: string;
}

export interface LastBatch {
  batch: CommandBatch;
  status: 'proposed' | 'executed' | 'cancelled';
  at: string;
}

export interface ConversationState {
  pending: PendingClarification | null;
  lastBatch: LastBatch | null;
  /** Butler focus: the email / draft / project / invoice the conversation is about (§96, §139). */
  focus?: ButlerFocus | null;
}

export const EMPTY_CONVERSATION_STATE: ConversationState = { pending: null, lastBatch: null };

export interface ContextInput {
  text: string;
  language: Language;
  now: DateTime;
  timezone: string;
  state: ConversationState;
  ttlMinutes: number;
}

export interface ContextResult {
  batch: CommandBatch;
  kind: 'clarification' | 'modification';
  /** Set when the modification targets a batch that was already executed. */
  supersedesBatchId: string | null;
}

const MODIFICATION: Record<Language, RegExp[]> = {
  en: [
    /^(?:no,?\s*)?(?:make|change|set)\s+(?:that|it|this)\s+(?:to\s+)?(?<payload>.+?)(?:\s+instead)?\.?$/iu,
    /^(?:no,?\s*)?(?:that|it)\s+should\s+be\s+(?<payload>.+?)\.?$/iu,
    /^(?:no,?\s*)?(?:actually|rather|instead),?\s+(?<payload>.+?)\.?$/iu,
    /^(?<payload>.+?)\s+instead\.?$/iu,
  ],
  nl: [
    /^(?:nee,?\s*)?(?:maak|zet|verander)\s+(?:dat|er|het|die)\s+(?:maar\s+)?(?:naar\s+|op\s+|om\s+)?(?<payload>.+?)(?:\s+in de plaats|\s+in plaats daarvan)?\.?$/iu,
    /^(?:nee,?\s*)?(?:doe|dat wordt|het wordt)\s+(?:dat\s+)?(?:maar\s+)?(?<payload>.+?)\.?$/iu,
    /^(?:nee,?\s*)?(?:liever|eerder|toch|eigenlijk),?\s+(?<payload>.+?)\.?$/iu,
    /^(?<payload>.+?)\s+(?:in de plaats|in plaats daarvan)\.?$/iu,
  ],
  fr: [
    /^(?:non,?\s*)?(?:mets|met|change|passe)\s+(?:ça|ca|cela|le|la)\s+(?:à|a|pour|en)?\s*(?<payload>.+?)(?:\s+plutôt|\s+plutot|\s+à la place|\s+a la place)?\.?$/iu,
    /^(?:non,?\s*)?(?:plutôt|plutot|finalement|en fait|disons),?\s+(?<payload>.+?)\.?$/iu,
    /^(?<payload>.+?)\s+(?:plutôt|plutot|à la place|a la place)\.?$/iu,
  ],
};

const AT_WORD: Record<Language, string> = { en: 'at', nl: 'om', fr: 'à' };
const HOUR_WORD: Record<Language, string> = { en: '', nl: ' uur', fr: ' heures' };

function isExpired(at: string, now: DateTime, ttlMinutes: number): boolean {
  const dt = DateTime.fromISO(at);
  return !dt.isValid || now.diff(dt, 'minutes').minutes > ttlMinutes;
}

function mergeWhen(existing: When | null, incoming: When, timezone: string): When {
  if (!existing) return incoming;
  const date = incoming.hasExplicitDate ? incoming.date : (existing.date ?? incoming.date);
  const time = incoming.hasExplicitTime || !existing.time ? incoming.time : existing.time;
  const dt = date && time ? DateTime.fromISO(`${date}T${time}`, { zone: timezone }) : null;
  const endTime = incoming.endTime ?? existing.endTime;
  const endDt = dt && endTime ? DateTime.fromISO(`${date}T${endTime}`, { zone: timezone }) : null;
  return {
    date,
    time,
    endDate: incoming.endDate ?? existing.endDate,
    endTime,
    iso: dt?.isValid ? dt.toISO({ suppressMilliseconds: true }) : null,
    endIso: endDt?.isValid ? endDt.toISO({ suppressMilliseconds: true }) : null,
    timezone,
    hasExplicitDate: existing.hasExplicitDate || incoming.hasExplicitDate,
    hasExplicitTime: existing.hasExplicitTime || incoming.hasExplicitTime,
    recurrence: incoming.recurrence ?? existing.recurrence,
    phrase: [existing.phrase, incoming.phrase].filter(Boolean).join(' ') || null,
  };
}

function applyWhen(command: Command, when: When, timezone: string): Command {
  switch (command.intent) {
    case 'CREATE_REMINDER':
    case 'CREATE_CALENDAR_EVENT':
    case 'CREATE_TASK':
    case 'CREATE_ALARM':
    case 'GET_AGENDA':
    case 'GET_TASKS':
    case 'DELETE_EVENT':
      return { ...command, when: mergeWhen(command.when, when, timezone), missingFields: command.missingFields.filter((f) => f !== 'when' && f !== 'time' && f !== 'date') };
    case 'UPDATE_TASK':
      return { ...command, changes: { ...command.changes, when: mergeWhen(command.changes.when ?? null, when, timezone) }, missingFields: [] };
    case 'UPDATE_EVENT':
      return { ...command, changes: { ...command.changes, when: mergeWhen(command.changes.when ?? null, when, timezone) }, missingFields: [] };
    default:
      return command;
  }
}

function applyTitle(command: Command, title: string): Command {
  const clean = sentenceCase(trimPunctuation(title));
  if (!clean) return command;
  switch (command.intent) {
    case 'CREATE_REMINDER':
    case 'CREATE_CALENDAR_EVENT':
    case 'CREATE_TASK':
    case 'CAPTURE_NOTE':
    case 'CAPTURE_IDEA':
      return { ...command, title: clean, missingFields: command.missingFields.filter((f) => f !== 'title') };
    case 'CREATE_ALARM':
    case 'CREATE_TIMER':
      return { ...command, label: clean };
    case 'COMPLETE_TASK':
    case 'UPDATE_TASK':
    case 'UPDATE_EVENT':
    case 'DELETE_EVENT':
      return { ...command, targetQuery: clean, missingFields: command.missingFields.filter((f) => f !== 'target') };
    case 'SEARCH_NOTES':
      return { ...command, query: clean, missingFields: [] };
    default:
      return command;
  }
}

export class ContextResolver {
  constructor(private readonly resolver: DateResolver = defaultResolver) {}

  resolve(input: ContextInput): ContextResult | null {
    const text = normalizeText(input.text);
    if (!text) return null;
    const pending = input.state.pending;
    if (pending && !isExpired(pending.createdAt, input.now, input.ttlMinutes)) {
      const filled = this.fillClarification(pending, text, input);
      if (filled) return { batch: filled, kind: 'clarification', supersedesBatchId: null };
    }
    const last = input.state.lastBatch;
    if (last && last.status !== 'cancelled' && !isExpired(last.at, input.now, input.ttlMinutes)) {
      const modified = this.applyModification(last, text, input);
      if (modified) return { batch: modified, kind: 'modification', supersedesBatchId: last.status === 'executed' ? last.batch.id : null };
    }
    return null;
  }

  private rc(input: ContextInput, command: Command | undefined): ResolveContext {
    return {
      now: input.now,
      timezone: input.timezone,
      language: input.language,
      timePolicy: command?.intent === 'CREATE_ALARM' ? 'morning' : 'business',
      preferFuture: command?.intent !== 'SEARCH_NOTES',
    };
  }

  /** "3" → "at 3"; "3:30" → "at 3:30"; leaves other text alone. */
  private normaliseBareTime(text: string, language: Language): string {
    if (/^\d{1,2}(?:[:.h]\d{2})?$/.test(text)) return `${AT_WORD[language]} ${text}${/[:.h]/.test(text) ? '' : HOUR_WORD[language]}`;
    return text;
  }

  private resolveWhen(text: string, input: ContextInput, command: Command | undefined): { when: When | null; remaining: string } {
    const candidate = this.normaliseBareTime(text, input.language);
    const ex = this.resolver.extract(candidate, this.rc(input, command));
    return { when: toWhen(ex.resolution, input.timezone), remaining: ex.remainingText };
  }

  private fillClarification(pending: PendingClarification, text: string, input: ContextInput): CommandBatch | null {
    const command = pending.batch.commands.find((c) => c.id === pending.commandId);
    if (!command) return null;
    // Butler tools complete their own clarifications (AdminParser.complete via the engine).
    if (command.intent === 'BUTLER_TOOL') return null;
    let updated: Command | null = null;
    if (pending.field === 'when' || pending.field === 'time' || pending.field === 'date' || pending.field === 'endTime') {
      const { when, remaining } = this.resolveWhen(text, input, command);
      const leftover = remaining.split(' ').filter(Boolean).length;
      if (when && leftover <= 2) updated = applyWhen(command, when, input.timezone);
    } else if (pending.field === 'duration') {
      const ex = this.resolver.extract(/^\d+$/.test(text) ? `${text} min` : text, this.rc(input, command));
      const minutes = ex.resolution?.durationMinutes ?? null;
      if (minutes && command.intent === 'CREATE_TIMER') updated = { ...command, durationSeconds: Math.round(minutes * 60), missingFields: [] };
    } else if (pending.field === 'title' || pending.field === 'target' || pending.field === 'query' || pending.field === 'content') {
      updated = applyTitle(command, input.text);
    }
    if (!updated) return null;
    updated = { ...updated, parser: 'context', clarificationQuestion: null };
    return {
      ...pending.batch,
      id: newId(),
      commands: pending.batch.commands.map((c) => (c.id === updated?.id ? updated : c)),
      originalText: `${pending.batch.originalText} → ${input.text}`,
      createdAt: input.now.toISO() ?? new Date().toISOString(),
    };
  }

  private applyModification(last: LastBatch, text: string, input: ContextInput): CommandBatch | null {
    let payload: string | null = null;
    for (const re of MODIFICATION[input.language]) {
      const m = re.exec(text);
      if (m?.groups?.payload) {
        payload = m.groups.payload.trim();
        break;
      }
    }
    if (!payload) return null;
    const target = last.batch.commands[last.batch.commands.length - 1];
    if (!target) return null;
    // "Maak het iets professioneler" after a Butler tool is a follow-up for the AdminParser, not a date/title modification.
    if (target.intent === 'BUTLER_TOOL') return null;
    const { when, remaining } = this.resolveWhen(payload, input, target);
    let updated: Command;
    if (when && remaining.split(' ').filter(Boolean).length <= 1) updated = applyWhen(target, when, input.timezone);
    else updated = applyTitle(target, payload);
    updated = { ...updated, id: newId(), parser: 'context', clarificationQuestion: null, warnings: updated.warnings.filter((w) => w !== 'PAST_DATE') };
    return {
      ...last.batch,
      id: newId(),
      commands: last.batch.commands.map((c) => (c.id === target.id ? updated : c)),
      originalText: `${last.batch.originalText} → ${input.text}`,
      createdAt: input.now.toISO() ?? new Date().toISOString(),
    };
  }
}

export const contextResolver = new ContextResolver();
