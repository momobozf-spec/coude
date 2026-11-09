import type { DateTime } from 'luxon';

import type { Command, When } from './schema';
import { formatDate, formatDuration, formatRecurrence, formatTimeRange } from '../date/format';
import { fill, t } from '../i18n/strings';
import type { Language } from '../types/common';

/**
 * Human-readable summaries of commands for the action preview, history and Siri dialogs.
 */

export interface CommandSummary {
  label: string;
  title: string;
  lines: string[];
}

export function describeWhen(when: When | null, language: Language, timezone: string, now?: DateTime): string[] {
  if (!when) return [];
  const lines: string[] = [];
  if (when.date) {
    const date = formatDate(when.date, language, timezone, now);
    if (when.time) lines.push(`${date} · ${formatTimeRange(when.time, when.endTime)}`);
    else lines.push(date);
  } else if (when.time) {
    lines.push(when.time);
  }
  if (when.recurrence) lines.push(formatRecurrence(when.recurrence, language));
  return lines;
}

export function describeCommand(command: Command, language: Language, timezone: string, now?: DateTime): CommandSummary {
  const s = t(language);
  const label = s.labels[command.intent];
  switch (command.intent) {
    case 'CAPTURE_NOTE':
    case 'CAPTURE_IDEA':
      return { label, title: command.title, lines: [command.content !== command.title ? command.content : '', command.category ?? ''].filter(Boolean) };
    case 'CREATE_TASK':
      return { label, title: command.title, lines: [...describeWhen(command.when, language, timezone, now), command.listName ? `#${command.listName}` : '', command.priority !== 'normal' ? command.priority : ''].filter(Boolean) };
    case 'CREATE_REMINDER':
      return { label, title: command.title, lines: describeWhen(command.when, language, timezone, now) };
    case 'CREATE_CALENDAR_EVENT': {
      const lines = describeWhen(command.when, language, timezone, now);
      if (command.durationMinutes && !command.when?.endTime) lines.push(formatDuration(command.durationMinutes, language));
      if (command.location) lines.push(`@ ${command.location}`);
      for (const a of command.alerts) lines.push(fill(s.reminderBefore, { n: Math.abs(a.offsetMinutes) }));
      if (command.notes) lines.push(command.notes);
      return { label, title: command.title, lines };
    }
    case 'CREATE_ALARM':
      return { label, title: command.label ?? s.alarm, lines: describeWhen(command.when, language, timezone, now) };
    case 'CREATE_TIMER':
      return { label, title: command.label ?? s.timer, lines: [command.durationSeconds ? formatDuration(Math.round(command.durationSeconds / 60), language) : '?'] };
    case 'COMPLETE_TASK':
      return { label, title: command.targetQuery, lines: [] };
    case 'UPDATE_TASK':
      return { label, title: command.targetQuery, lines: [...describeWhen(command.changes.when ?? null, language, timezone, now), command.changes.title ? `→ ${command.changes.title}` : ''].filter(Boolean) };
    case 'UPDATE_EVENT':
      return { label, title: command.targetQuery, lines: describeWhen(command.changes.when ?? null, language, timezone, now) };
    case 'DELETE_EVENT':
      return { label, title: command.targetQuery, lines: describeWhen(command.when, language, timezone, now) };
    case 'SEARCH_NOTES':
      return { label, title: command.query, lines: [command.filters.from ? formatDate(command.filters.from, language, timezone, now) : '', command.filters.types.join(', ')].filter(Boolean) };
    case 'GET_AGENDA':
      return { label, title: command.when?.date ? formatDate(command.when.date, language, timezone, now) : formatDate(now?.toISODate() ?? '', language, timezone, now), lines: [] };
    case 'GET_TASKS':
      return { label, title: command.when?.date ? formatDate(command.when.date, language, timezone, now) : command.filter, lines: [] };
    case 'BUTLER_TOOL':
      return { label: command.preview.label, title: command.preview.title, lines: command.preview.lines };
    case 'UNKNOWN':
    default:
      return { label, title: 'text' in command ? command.text : '', lines: [] };
  }
}
