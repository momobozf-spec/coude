import { DateTime } from 'luxon';

import type { EngineConfig } from './config';
import { isDestructiveIntent, type Command } from './schema';
import { getTool } from '../butler/catalog';
import { t } from '../i18n/strings';
import type { Language } from '../types/common';

/**
 * CommandValidator – decides whether a parsed command is complete, sane and safe.
 * It annotates the command (missingFields, clarificationQuestion,
 * requiresConfirmation, warnings) and returns structured issues for the UI.
 * It never executes anything and never guesses missing information.
 */

export type ValidationCode =
  | 'MISSING_TITLE'
  | 'MISSING_WHEN'
  | 'MISSING_TIME'
  | 'MISSING_DURATION'
  | 'MISSING_TARGET'
  | 'MISSING_QUERY'
  | 'PAST_DATE'
  | 'INVALID_DATE'
  | 'END_BEFORE_START'
  | 'NO_EXPLICIT_TIME'
  | 'LOW_CONFIDENCE'
  | 'DESTRUCTIVE'
  | 'UNKNOWN_INTENT'
  | 'INVALID_TOOL'
  | 'INVALID_ARGUMENTS'
  | 'MISSING_INFO'
  | 'CONFIRM_REQUIRED';

export interface ValidationIssue {
  code: ValidationCode;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export interface ValidationContext {
  now: DateTime;
  timezone: string;
  language: Language;
  config: EngineConfig;
}

export interface ValidationResult {
  command: Command;
  issues: ValidationIssue[];
}

function isPastIso(iso: string | null, now: DateTime): boolean {
  if (!iso) return false;
  const dt = DateTime.fromISO(iso);
  return dt.isValid && dt < now.minus({ minutes: 1 });
}

function isInvalidIso(iso: string | null): boolean {
  if (!iso) return false;
  return !DateTime.fromISO(iso).isValid;
}

export class CommandValidator {
  validate(input: Command, ctx: ValidationContext): ValidationResult {
    const s = t(ctx.language);
    const issues: ValidationIssue[] = [];
    const command: Command = { ...input, missingFields: [...input.missingFields], warnings: [...input.warnings] };
    const add = (code: ValidationCode, severity: 'error' | 'warning', field: string, message: string) => {
      issues.push({ code, severity, field, message });
    };

    switch (command.intent) {
      case 'CREATE_REMINDER': {
        if (!command.title.trim()) add('MISSING_TITLE', 'error', 'title', s.askTitle);
        if (!command.when || (!command.when.date && !command.when.iso)) add('MISSING_WHEN', 'error', 'when', s.askWhenReminder);
        else {
          if (isInvalidIso(command.when.iso)) add('INVALID_DATE', 'error', 'when', s.askWhenReminder);
          if (!command.when.time && !command.when.recurrence) add('MISSING_TIME', 'error', 'time', s.askTime);
          else if (!command.when.hasExplicitTime) add('NO_EXPLICIT_TIME', 'warning', 'time', s.noExplicitTime);
          if (!command.when.recurrence && isPastIso(command.when.iso, ctx.now)) add('PAST_DATE', 'error', 'when', s.pastDate);
        }
        break;
      }
      case 'CREATE_CALENDAR_EVENT': {
        if (!command.title.trim()) add('MISSING_TITLE', 'error', 'title', s.askTitle);
        if (!command.when || !command.when.date) add('MISSING_WHEN', 'error', 'when', s.askWhen);
        else {
          if (isInvalidIso(command.when.iso)) add('INVALID_DATE', 'error', 'when', s.askWhen);
          if (!command.when.time && !command.allDay) add('MISSING_TIME', 'error', 'time', s.askTime);
          else if (!command.when.hasExplicitTime && !command.allDay) add('NO_EXPLICIT_TIME', 'warning', 'time', s.noExplicitTime);
          if (command.when.iso && command.when.endIso && DateTime.fromISO(command.when.endIso) <= DateTime.fromISO(command.when.iso)) {
            add('END_BEFORE_START', 'error', 'endTime', s.endBeforeStart);
          }
          if (!command.when.recurrence && isPastIso(command.when.iso, ctx.now)) add('PAST_DATE', 'error', 'when', s.pastDate);
        }
        break;
      }
      case 'CREATE_ALARM': {
        if (!command.when || !command.when.time) add('MISSING_TIME', 'error', 'time', s.askTime);
        else {
          if (isInvalidIso(command.when.iso)) add('INVALID_DATE', 'error', 'when', s.askTime);
          if (!command.when.recurrence && isPastIso(command.when.iso, ctx.now)) add('PAST_DATE', 'error', 'when', s.pastDate);
        }
        break;
      }
      case 'CREATE_TIMER': {
        if (!command.durationSeconds || command.durationSeconds <= 0) add('MISSING_DURATION', 'error', 'duration', s.askDuration);
        break;
      }
      case 'CREATE_TASK': {
        if (!command.title.trim()) add('MISSING_TITLE', 'error', 'title', s.askTitle);
        if (command.when?.iso && isInvalidIso(command.when.iso)) add('INVALID_DATE', 'error', 'when', s.askWhen);
        if (command.when?.iso && !command.when.recurrence && isPastIso(command.when.iso, ctx.now)) add('PAST_DATE', 'warning', 'when', s.pastDate);
        break;
      }
      case 'CAPTURE_NOTE':
      case 'CAPTURE_IDEA': {
        if (!command.content.trim()) add('MISSING_TITLE', 'error', 'content', s.askTitle);
        break;
      }
      case 'COMPLETE_TASK':
      case 'UPDATE_TASK':
      case 'UPDATE_EVENT':
      case 'DELETE_EVENT': {
        if (!command.targetQuery.trim()) add('MISSING_TARGET', 'error', 'target', s.askTarget);
        if (command.intent === 'UPDATE_TASK' && !command.changes.when && !command.changes.title && !command.changes.priority && !command.changes.status) {
          add('MISSING_WHEN', 'error', 'when', s.askWhen);
        }
        break;
      }
      case 'SEARCH_NOTES': {
        if (!command.query.trim()) add('MISSING_QUERY', 'error', 'query', s.askQuery);
        break;
      }
      case 'GET_AGENDA':
      case 'GET_TASKS':
        break;
      case 'BUTLER_TOOL': {
        const definition = getTool(command.tool);
        if (!definition) {
          add('INVALID_TOOL', 'error', 'tool', s.unknown);
          break;
        }
        for (const field of input.missingFields) add('MISSING_INFO', 'error', field, input.clarificationQuestion ?? s.toolArgsInvalid);
        if (input.missingFields.length === 0 && !definition.schema.safeParse(command.args).success) add('INVALID_ARGUMENTS', 'error', 'args', s.toolArgsInvalid);
        if (definition.permission === 'external') add('CONFIRM_REQUIRED', 'warning', 'permission', s.externalConfirm);
        else if (definition.permission === 'sensitive') add('CONFIRM_REQUIRED', 'warning', 'permission', s.sensitiveConfirm);
        break;
      }
      case 'UNKNOWN': {
        add('UNKNOWN_INTENT', 'error', 'intent', s.unknown);
        break;
      }
      default:
        break;
    }

    if (isDestructiveIntent(command.intent)) add('DESTRUCTIVE', 'warning', 'intent', s.destructive);
    if (command.confidence < ctx.config.thresholds.confirm) add('LOW_CONFIDENCE', 'warning', 'confidence', s.lowConfidence);

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    command.missingFields = Array.from(new Set(errors.map((e) => e.field)));
    command.clarificationQuestion = errors[0]?.message ?? null;
    for (const w of warnings) if (!command.warnings.includes(w.code)) command.warnings.push(w.code);
    command.requiresConfirmation =
      errors.length > 0 || warnings.length > 0 || isDestructiveIntent(command.intent) || command.confidence < ctx.config.thresholds.autoConfirm;

    return { command, issues };
  }
}

export const commandValidator = new CommandValidator();
