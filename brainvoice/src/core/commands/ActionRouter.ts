import { DateTime } from 'luxon';

import type { AlarmRecord, CalendarEventInput, PlatformAdapters, ReminderRecord } from './adapters';
import { createDefaultButlerAdapters, type ButlerAdapters } from '../butler/adapters';
import { EMPTY_FOCUS, isFocusFresh, mergeFocus } from '../butler/focus';
import type { ToolPayload } from '../butler/payloads';
import type { ToolRegistry } from '../butler/ToolRegistry';
import { describeCommand } from '../intent/describe';
import { markLastBatch } from '../intent/IntentEngine';
import type { Command, CommandBatch, CommandOf, When } from '../intent/schema';
import type { Agenda } from '../services/AgendaService';
import type { Clock } from '../services/Clock';
import type { CoreServices } from '../services';
import type { UndoPlan } from '../services/HistoryService';
import type { SearchResult } from '../services/SearchService';
import { dueFromWhen } from '../services/TaskService';
import { explainError } from '../errors/messages';
import { t } from '../i18n/strings';
import type { CalendarEventMirror, ItemRef, Reminder, Task } from '../domain/entities';
import type { Logger } from '../logging/logger';
import type { OpsServices } from '../ops';
import { DomainError, type Language } from '../types/common';

/**
 * ActionRouter – executes validated commands through the platform adapters and
 * the local services, records every action in the history (for undo) and
 * never re-interprets text: everything it needs is on the command.
 */

export type QueryPayload =
  | { kind: 'agenda'; agenda: Agenda }
  | { kind: 'tasks'; filter: CommandOf<'GET_TASKS'>['filter']; tasks: Task[] }
  | { kind: 'search'; query: string; results: SearchResult[] }
  | { kind: 'ambiguous'; candidates: { id: string; title: string }[] }
  | { kind: 'tool'; tool: string; payload: ToolPayload | null };

export interface ActionResult {
  commandId: string;
  intent: Command['intent'];
  ok: boolean;
  summary: string;
  detail: string[];
  externalIds: Record<string, string>;
  undoable: boolean;
  historyId: string | null;
  createdItem: ItemRef | null;
  payload: QueryPayload | null;
  error: DomainError | null;
  /** Human explanation when a fallback was used (e.g. notification instead of AlarmKit). */
  note: string | null;
  /** Where the command ran in connected mode: on the device or on the Alfred server. */
  origin?: 'local' | 'remote';
}

interface HandlerOutcome {
  summary: string;
  detail: string[];
  externalIds: Record<string, string>;
  plan: UndoPlan;
  createdItem: ItemRef | null;
  payload: QueryPayload | null;
  note: string | null;
}

export interface ActionRouterDeps {
  services: CoreServices;
  adapters: PlatformAdapters;
  clock: Clock;
  language: () => Language;
  logger?: Logger;
  /** Butler tools (spec §138); when absent, BUTLER_TOOL commands fail with TOOL_NOT_FOUND. */
  tools?: ToolRegistry | null;
  butlerAdapters?: ButlerAdapters;
  /** Operations layer (§141–§181); attached after construction via `setOps` because it depends on the router. */
  ops?: OpsServices | null;
}

const NOTIFY_TASK_BODY: Record<Language, string> = { en: 'Task due now', nl: 'Taak is nu gepland', fr: 'Tâche prévue maintenant' };
const TIMER_DONE: Record<Language, string> = { en: 'Timer finished', nl: 'Timer afgelopen', fr: 'Minuteur terminé' };
const ALARM_TITLE: Record<Language, string> = { en: 'Alarm', nl: 'Wekker', fr: 'Réveil' };
const NOT_NEXT_OCCURRENCE: Record<Language, string> = {
  en: 'The clock app only supports a time, not a date. Because this alarm is not for the next occurrence of that time, I scheduled a time-sensitive notification instead.',
  nl: 'De klok-app ondersteunt enkel een tijdstip, geen datum. Omdat deze wekker niet voor de eerstvolgende keer is, plande ik een tijdgevoelige melding.',
  fr: 'L’app Horloge ne gère qu’une heure, pas une date. Comme cette alarme n’est pas pour la prochaine occurrence, j’ai programmé une notification prioritaire.',
};

export class ActionRouter {
  private readonly services: CoreServices;
  private readonly adapters: PlatformAdapters;
  private readonly clock: Clock;
  private readonly language: () => Language;
  private readonly logger: Logger | undefined;
  private readonly tools: ToolRegistry | null;
  private readonly butlerAdapters: ButlerAdapters;
  private ops: OpsServices | null;

  constructor(deps: ActionRouterDeps) {
    this.services = deps.services;
    this.adapters = deps.adapters;
    this.clock = deps.clock;
    this.language = deps.language;
    this.logger = deps.logger;
    this.tools = deps.tools ?? null;
    this.butlerAdapters = deps.butlerAdapters ?? createDefaultButlerAdapters();
    this.ops = deps.ops ?? null;
  }

  setOps(ops: OpsServices | null): void {
    this.ops = ops;
  }

  /** Executes every command in order. One failure does not stop the others. */
  async execute(batch: CommandBatch): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    for (const command of batch.commands) results.push(await this.executeOne(batch, command));
    const state = await this.services.context.load();
    await this.services.context.save(markLastBatch(state, batch.id, 'executed', this.clock.now()));
    return results;
  }

  async executeOne(batch: CommandBatch, command: Command): Promise<ActionResult> {
    const language = this.language();
    const summaryOf = () => {
      const d = describeCommand(command, language, this.timezone(), this.now());
      return `${d.label} · ${d.title}`;
    };
    try {
      const outcome = await this.handle(batch, command);
      const entry = await this.services.history.record({ batchId: batch.id, originalText: batch.originalText, command, summary: outcome.summary, externalIds: outcome.externalIds, plan: outcome.plan });
      return { commandId: command.id, intent: command.intent, ok: true, summary: outcome.summary, detail: outcome.detail, externalIds: outcome.externalIds, undoable: outcome.plan.kind !== 'none', historyId: entry.id, createdItem: outcome.createdItem, payload: outcome.payload, error: null, note: outcome.note };
    } catch (e) {
      const error = DomainError.from(e);
      this.logger?.error('command failed', { intent: command.intent, code: error.code, message: error.message });
      const payload: QueryPayload | null = error.code === 'AMBIGUOUS_COMMAND' && Array.isArray(error.details?.candidates) ? { kind: 'ambiguous', candidates: error.details.candidates as { id: string; title: string }[] } : null;
      const entry = await this.services.history.record({ batchId: batch.id, originalText: batch.originalText, command, summary: summaryOf(), externalIds: {}, plan: { kind: 'none', reason: error.code }, error: error.message }).catch(() => null);
      return { commandId: command.id, intent: command.intent, ok: false, summary: summaryOf(), detail: [explainError(error.code, language)], externalIds: {}, undoable: false, historyId: entry?.id ?? null, createdItem: null, payload, error, note: null };
    }
  }

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------

  async undo(historyId: string): Promise<{ ok: boolean; message: string }> {
    const language = this.language();
    const entry = await this.services.history.getById(historyId);
    if (!entry) return { ok: false, message: explainError('NOT_FOUND', language) };
    if (entry.undoStatus !== 'available') return { ok: false, message: explainError('UNDO_NOT_POSSIBLE', language) };
    const plan = this.services.history.planOf(entry);
    try {
      await this.applyUndo(plan);
      await this.services.history.setUndoStatus(historyId, 'undone');
      return { ok: true, message: entry.summary };
    } catch (e) {
      const error = DomainError.from(e);
      this.logger?.error('undo failed', { historyId, code: error.code, message: error.message });
      await this.services.history.setUndoStatus(historyId, 'failed', error.message);
      return { ok: false, message: explainError(error.code, language) };
    }
  }

  private async applyUndo(plan: UndoPlan): Promise<void> {
    const s = this.services;
    switch (plan.kind) {
      case 'delete_note':
        await s.notes.delete(plan.noteId);
        if (plan.captureId) await s.captures.archive(plan.captureId);
        return;
      case 'delete_task':
        if (plan.notificationId) await this.adapters.notifications.cancel(plan.notificationId).catch(() => undefined);
        await s.tasks.delete(plan.taskId);
        if (plan.captureId) await s.captures.archive(plan.captureId);
        return;
      case 'delete_event':
        if (plan.externalId) await this.adapters.calendar.deleteEvent(plan.externalId);
        await s.events.hardDelete(plan.eventId);
        if (plan.captureId) await s.captures.archive(plan.captureId);
        return;
      case 'delete_reminder': {
        if (plan.backend !== 'none') await this.adapters.reminders.delete({ backend: plan.backend, externalId: plan.externalId, notificationId: plan.notificationId }).catch(() => undefined);
        if (plan.notificationId) await this.adapters.notifications.cancel(plan.notificationId).catch(() => undefined);
        await s.reminders.delete(plan.reminderId);
        if (plan.captureId) await s.captures.archive(plan.captureId);
        return;
      }
      case 'cancel_alarm': {
        const alarm = await s.alarms.getById(plan.alarmId);
        const record: AlarmRecord = { backend: plan.record.backend as AlarmRecord['backend'], externalId: plan.record.externalId, notificationId: plan.record.notificationId, canCancel: plan.record.canCancel, note: null };
        let cancelled = false;
        if (alarm?.kind === 'timer') cancelled = await this.adapters.timers.cancelTimer(record);
        else cancelled = await this.adapters.alarms.cancelAlarm(record);
        if (plan.record.notificationId) await this.adapters.notifications.cancel(plan.record.notificationId).catch(() => undefined);
        if (!cancelled && !plan.record.notificationId) throw new DomainError('UNDO_NOT_POSSIBLE', 'The clock app does not allow cancelling this alarm');
        await s.alarms.setStatus(plan.alarmId, 'cancelled');
        return;
      }
      case 'restore_task':
        await s.tasks.update(plan.taskId, plan.previous as Partial<Task>);
        return;
      case 'restore_event': {
        const previous = plan.previous as Partial<CalendarEventMirror>;
        if (plan.externalId && previous.startAt && previous.endAt) {
          await this.adapters.calendar.updateEvent(plan.externalId, { title: previous.title, startISO: previous.startAt, endISO: previous.endAt, location: previous.location ?? null, notes: previous.notes ?? null });
        }
        await s.events.update(plan.eventId, previous);
        return;
      }
      case 'recreate_event': {
        const previous = plan.previous as unknown as CalendarEventMirror;
        const record = await this.adapters.calendar.createEvent({ title: previous.title, startISO: previous.startAt, endISO: previous.endAt, allDay: previous.allDay, location: previous.location, notes: previous.notes, alerts: previous.alerts, recurrence: previous.recurrence, timezone: this.timezone() });
        await s.events.update(plan.eventId, { externalId: record.externalId, calendarId: record.calendarId, deletedAt: null });
        await s.events.restore(plan.eventId);
        return;
      }
      case 'restore_reminder':
        await s.reminders.update(plan.reminderId, plan.previous as Partial<Reminder>);
        return;
      case 'tool_undo':
        if (!this.tools) throw new DomainError('UNDO_NOT_POSSIBLE', 'Butler tools unavailable');
        await this.tools.undo(plan.undo, this.services);
        return;
      case 'none':
      default:
        throw new DomainError('UNDO_NOT_POSSIBLE', plan.kind === 'none' ? plan.reason : 'unknown plan');
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handle(batch: CommandBatch, command: Command): Promise<HandlerOutcome> {
    switch (command.intent) {
      case 'CAPTURE_NOTE':
      case 'CAPTURE_IDEA':
        return this.captureNote(batch, command);
      case 'CREATE_TASK':
        return this.createTask(batch, command);
      case 'CREATE_REMINDER':
        return this.createReminder(batch, command);
      case 'CREATE_CALENDAR_EVENT':
        return this.createEvent(batch, command);
      case 'CREATE_ALARM':
        return this.createAlarm(batch, command);
      case 'CREATE_TIMER':
        return this.createTimer(batch, command);
      case 'COMPLETE_TASK':
        return this.completeTask(command);
      case 'UPDATE_TASK':
        return this.updateTask(command);
      case 'UPDATE_EVENT':
        return this.updateEvent(command);
      case 'DELETE_EVENT':
        return this.deleteEvent(command);
      case 'SEARCH_NOTES':
        return this.searchNotes(command);
      case 'GET_AGENDA':
        return this.getAgenda(command);
      case 'GET_TASKS':
        return this.getTasks(command);
      case 'BUTLER_TOOL':
        return this.runTool(batch, command);
      case 'UNKNOWN':
      default:
        throw new DomainError('VALIDATION_FAILED', 'Unknown command cannot be executed');
    }
  }

  /**
   * Executes a Butler tool (spec §138). The engine's decision policy guarantees that
   * write/sensitive/external tools only reach the router after the user confirmed the
   * preview, so `confirmed` is true here; the registry still enforces it for other callers.
   */
  private async runTool(batch: CommandBatch, command: CommandOf<'BUTLER_TOOL'>): Promise<HandlerOutcome> {
    if (!this.tools) throw new DomainError('TOOL_NOT_FOUND', 'Butler tools are not available');
    const nowISO = this.clock.nowISO();
    const state = await this.services.context.load();
    const focus = isFocusFresh(state.focus, nowISO) ? state.focus : EMPTY_FOCUS;
    const outcome = await this.tools.execute(command.tool, command.args, {
      services: this.services,
      adapters: this.butlerAdapters,
      clock: this.clock,
      language: this.language(),
      focus,
      confirmed: true,
      batchId: batch.id,
      originalText: batch.originalText,
      logger: this.logger,
      ops: this.ops,
    });
    if (outcome.focus) {
      const latest = await this.services.context.load();
      await this.services.context.save({ ...latest, focus: mergeFocus(focus, outcome.focus, nowISO) });
    }
    return {
      summary: outcome.summary,
      detail: outcome.detail,
      externalIds: outcome.externalIds ?? {},
      plan: outcome.undo && outcome.undo.kind !== 'none' ? { kind: 'tool_undo', undo: outcome.undo } : { kind: 'none', reason: 'tool' },
      createdItem: outcome.createdItem ?? null,
      payload: { kind: 'tool', tool: command.tool, payload: outcome.payload },
      note: outcome.note ?? null,
    };
  }

  private summary(command: Command): { summary: string; detail: string[] } {
    const d = describeCommand(command, this.language(), this.timezone(), this.now());
    return { summary: `${d.label} · ${d.title}`, detail: d.lines };
  }

  private now(): DateTime {
    return this.clock.now();
  }

  private timezone(): string {
    return this.clock.timezone();
  }

  private async captureNote(batch: CommandBatch, command: CommandOf<'CAPTURE_NOTE' | 'CAPTURE_IDEA'>): Promise<HandlerOutcome> {
    const type = command.intent === 'CAPTURE_IDEA' ? 'IDEA' : command.noteType;
    const capture = await this.services.captures.recordForCommand({ batch, command, type, title: command.title, cleanedText: command.content, item: null, category: command.category, tags: command.tags, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    const note = await this.services.notes.create({ type, title: command.title, content: command.content, category: command.category, tags: command.tags, people: command.people, captureId: capture.id, language: command.language });
    await this.services.captures.markProcessed(capture.id, { type, id: note.id }, type, note.title);
    const { summary, detail } = this.summary(command);
    return { summary, detail, externalIds: {}, plan: { kind: 'delete_note', noteId: note.id, captureId: capture.id }, createdItem: { type, id: note.id }, payload: null, note: null };
  }

  private async createTask(batch: CommandBatch, command: CommandOf<'CREATE_TASK'>): Promise<HandlerOutcome> {
    const capture = await this.services.captures.recordForCommand({ batch, command, type: 'TASK', title: command.title, cleanedText: command.title, item: null, category: command.category, tags: command.tags, dueAt: command.when?.iso ?? null, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    const task = await this.services.tasks.create({ title: command.title, description: command.description, when: command.when, priority: command.priority, category: command.category, tags: command.tags, people: command.people, listName: command.listName, captureId: capture.id, source: batch.source });
    let notificationId: string | null = null;
    if (task.dueAt && this.services.settings.get().notifyTasksWithTime) {
      try {
        if ((await this.adapters.notifications.getPermission()) === 'granted' || (await this.adapters.notifications.requestPermission()) === 'granted') {
          notificationId = await this.adapters.notifications.schedule({ title: task.title, body: NOTIFY_TASK_BODY[this.language()], fireISO: task.dueAt, categoryId: 'task', data: { taskId: task.id } });
          await this.services.tasks.update(task.id, { reminderAt: task.dueAt, reminderNotificationId: notificationId });
        }
      } catch (e) {
        this.logger?.warn('task notification not scheduled', { message: e instanceof Error ? e.message : String(e) });
      }
    }
    await this.services.captures.markProcessed(capture.id, { type: 'TASK', id: task.id }, 'TASK', task.title);
    const { summary, detail } = this.summary(command);
    return { summary, detail, externalIds: notificationId ? { notificationId } : {}, plan: { kind: 'delete_task', taskId: task.id, captureId: capture.id, notificationId }, createdItem: { type: 'TASK', id: task.id }, payload: null, note: null };
  }

  private async createReminder(batch: CommandBatch, command: CommandOf<'CREATE_REMINDER'>): Promise<HandlerOutcome> {
    const when = requireWhen(command.when);
    const dueISO = when.iso ?? isoFrom(when, this.timezone());
    if (!dueISO) throw new DomainError('INVALID_DATE');
    const capture = await this.services.captures.recordForCommand({ batch, command, type: 'REMINDER', title: command.title, cleanedText: command.title, item: null, dueAt: dueISO, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    const reminderId = crypto_id();
    let record: ReminderRecord;
    let note: string | null = null;
    const useSystem = this.services.settings.get().reminderBackend === 'system';
    try {
      if (!useSystem) throw new DomainError('REMINDERS_PERMISSION_DENIED', 'app backend selected');
      const permission = (await this.adapters.reminders.getPermission()) === 'granted' ? 'granted' : await this.adapters.reminders.requestPermission();
      if (permission === 'unavailable') throw new DomainError('UNKNOWN', 'System reminders are not available on this platform');
      if (permission !== 'granted') throw new DomainError('REMINDERS_PERMISSION_DENIED');
      record = await this.adapters.reminders.create({ localId: reminderId, title: command.title, dueISO, notes: command.notes, recurrence: when.recurrence, timezone: this.timezone() });
    } catch (e) {
      const error = DomainError.from(e);
      if (error.code !== 'REMINDERS_PERMISSION_DENIED' && error.code !== 'UNKNOWN') throw error;
      // Closest legitimate alternative: a local notification.
      const permission = (await this.adapters.notifications.getPermission()) === 'granted' ? 'granted' : await this.adapters.notifications.requestPermission();
      if (permission !== 'granted') throw new DomainError('NOTIFICATION_PERMISSION_DENIED');
      const notificationId = await this.adapters.notifications.schedule({ id: reminderId, title: command.title, body: command.notes ?? t(this.language()).labels.CREATE_REMINDER, fireISO: dueISO, categoryId: 'reminder', data: { reminderId }, recurrence: when.recurrence, timeSensitive: true });
      record = { backend: 'notification', externalId: null, notificationId };
      if (useSystem && error.code === 'REMINDERS_PERMISSION_DENIED') note = explainError('REMINDERS_PERMISSION_DENIED', this.language());
    }
    const reminder = await this.services.reminders.create({ title: command.title, notes: command.notes, dueAt: dueISO, recurrence: when.recurrence, backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, captureId: capture.id });
    await this.services.captures.markProcessed(capture.id, { type: 'REMINDER', id: reminder.id }, 'REMINDER', reminder.title);
    const { summary, detail } = this.summary(command);
    const externalIds: Record<string, string> = {};
    if (record.externalId) externalIds.reminderId = record.externalId;
    if (record.notificationId) externalIds.notificationId = record.notificationId;
    return { summary, detail, externalIds, plan: { kind: 'delete_reminder', reminderId: reminder.id, backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, captureId: capture.id }, createdItem: { type: 'REMINDER', id: reminder.id }, payload: null, note };
  }

  private async createEvent(batch: CommandBatch, command: CommandOf<'CREATE_CALENDAR_EVENT'>): Promise<HandlerOutcome> {
    const when = requireWhen(command.when);
    const zone = this.timezone();
    const defaultDuration = this.services.settings.get().defaultEventDurationMinutes;
    let startISO: string | null;
    let endISO: string | null;
    if (command.allDay || !when.time) {
      const day = DateTime.fromISO(when.date ?? '', { zone });
      startISO = day.startOf('day').toISO({ suppressMilliseconds: true });
      endISO = day.plus({ days: 1 }).startOf('day').toISO({ suppressMilliseconds: true });
    } else {
      startISO = when.iso ?? isoFrom(when, zone);
      endISO = when.endIso ?? (startISO ? DateTime.fromISO(startISO).plus({ minutes: command.durationMinutes ?? defaultDuration }).toISO({ suppressMilliseconds: true }) : null);
    }
    if (!startISO || !endISO) throw new DomainError('INVALID_DATE');
    const permission = (await this.adapters.calendar.getPermission()) === 'granted' ? 'granted' : await this.adapters.calendar.requestPermission();
    if (permission !== 'granted') throw new DomainError('CALENDAR_PERMISSION_DENIED');
    const capture = await this.services.captures.recordForCommand({ batch, command, type: 'EVENT', title: command.title, cleanedText: command.title, item: null, scheduledAt: startISO, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    const record = await this.adapters.calendar.createEvent({ title: command.title, startISO, endISO, allDay: command.allDay || !when.time, location: command.location, notes: command.notes, alerts: command.alerts, recurrence: when.recurrence, timezone: zone });
    const event = await this.services.events.create({ captureId: capture.id, title: command.title, startAt: startISO, endAt: endISO, allDay: command.allDay || !when.time, location: command.location, notes: command.notes, calendarId: record.calendarId, externalId: record.externalId, alerts: command.alerts, recurrence: when.recurrence, people: command.people });
    await this.services.captures.markProcessed(capture.id, { type: 'EVENT', id: event.id }, 'EVENT', event.title);
    const { summary, detail } = this.summary(command);
    return { summary, detail, externalIds: { eventId: record.externalId }, plan: { kind: 'delete_event', eventId: event.id, externalId: record.externalId, captureId: capture.id }, createdItem: { type: 'EVENT', id: event.id }, payload: null, note: null };
  }

  private async createAlarm(batch: CommandBatch, command: CommandOf<'CREATE_ALARM'>): Promise<HandlerOutcome> {
    const when = requireWhen(command.when);
    const zone = this.timezone();
    const fireISO = when.iso ?? isoFrom(when, zone);
    if (!fireISO || !when.time) throw new DomainError('INVALID_DATE');
    const [hour, minute] = when.time.split(':').map(Number);
    const label = command.label ?? ALARM_TITLE[this.language()];
    const capture = await this.services.captures.recordForCommand({ batch, command, type: 'REMINDER', title: label, cleanedText: label, item: null, scheduledAt: fireISO, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    const localId = crypto_id();
    const caps = await this.adapters.alarms.capabilities();
    let record: AlarmRecord | null = null;
    let note: string | null = caps.limitationNote;
    const nextOccurrence = nextTimeOccurrence(hour ?? 0, minute ?? 0, this.now(), zone);
    const isNextOccurrence = nextOccurrence.toISODate() === DateTime.fromISO(fireISO, { zone }).toISODate();
    const canUseClock = caps.supportsExactDate || when.recurrence !== null || isNextOccurrence;
    if (canUseClock) {
      try {
        const permission = (await this.adapters.alarms.getPermission()) === 'granted' ? 'granted' : await this.adapters.alarms.requestPermission();
        if (permission !== 'granted' && permission !== 'unavailable') throw new DomainError('ALARM_PERMISSION_DENIED');
        record = await this.adapters.alarms.setAlarm({ localId, fireISO, hour: hour ?? 0, minute: minute ?? 0, label, recurrence: when.recurrence, timezone: zone });
        if (record.note) note = record.note;
      } catch (e) {
        const error = DomainError.from(e);
        if (error.code !== 'ALARM_PERMISSION_DENIED' && error.code !== 'ALARM_NOT_SUPPORTED' && error.code !== 'UNKNOWN') throw error;
        note = explainError(error.code === 'UNKNOWN' ? 'ALARM_NOT_SUPPORTED' : error.code, this.language());
        record = null;
      }
    } else {
      note = NOT_NEXT_OCCURRENCE[this.language()];
    }
    if (!record || (record.backend === 'android_clock' && !when.recurrence)) {
      // Safety net / fallback: a time-sensitive local notification at the exact moment.
      const permission = (await this.adapters.notifications.getPermission()) === 'granted' ? 'granted' : await this.adapters.notifications.requestPermission();
      if (permission !== 'granted' && !record) throw new DomainError('NOTIFICATION_PERMISSION_DENIED');
      if (permission === 'granted') {
        const notificationId = await this.adapters.notifications.schedule({ id: `${localId}-notif`, title: label, body: when.time, fireISO, categoryId: 'alarm', data: { alarmId: localId }, timeSensitive: true, recurrence: when.recurrence });
        record = record ? { ...record, notificationId } : { backend: 'notification', externalId: null, notificationId, canCancel: true, note };
      }
    }
    if (!record) throw new DomainError('ALARM_NOT_SUPPORTED');
    const alarm = await this.services.alarms.create({ kind: 'alarm', label, fireAt: fireISO, durationSeconds: null, recurrence: when.recurrence, backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, canCancel: record.canCancel || Boolean(record.notificationId), captureId: capture.id });
    await this.services.captures.markProcessed(capture.id, { type: 'REMINDER', id: alarm.id }, 'REMINDER', label);
    const { summary, detail } = this.summary(command);
    const externalIds: Record<string, string> = {};
    if (record.externalId) externalIds.alarmId = record.externalId;
    if (record.notificationId) externalIds.notificationId = record.notificationId;
    return { summary, detail, externalIds, plan: { kind: 'cancel_alarm', alarmId: alarm.id, record: { backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, canCancel: record.canCancel } }, createdItem: { type: 'REMINDER', id: alarm.id }, payload: null, note };
  }

  private async createTimer(batch: CommandBatch, command: CommandOf<'CREATE_TIMER'>): Promise<HandlerOutcome> {
    const seconds = command.durationSeconds;
    if (!seconds || seconds <= 0) throw new DomainError('VALIDATION_FAILED', 'Timer needs a duration');
    const label = command.label ?? t(this.language()).timer;
    const localId = crypto_id();
    const fireISO = this.now().plus({ seconds }).toISO({ suppressMilliseconds: true }) ?? new Date(Date.now() + seconds * 1000).toISOString();
    const capture = await this.services.captures.recordForCommand({ batch, command, type: 'REMINDER', title: label, cleanedText: label, item: null, scheduledAt: fireISO, keepTranscript: this.services.settings.get().privacy.keepTranscripts });
    let record: AlarmRecord | null = null;
    let note: string | null = null;
    try {
      record = await this.adapters.timers.startTimer({ localId, seconds, label });
      note = record.note;
    } catch (e) {
      const error = DomainError.from(e);
      if (error.code !== 'ALARM_NOT_SUPPORTED' && error.code !== 'ALARM_PERMISSION_DENIED' && error.code !== 'UNKNOWN') throw error;
      note = explainError(error.code === 'UNKNOWN' ? 'ALARM_NOT_SUPPORTED' : error.code, this.language());
    }
    if (!record || record.backend === 'in_app') {
      const permission = (await this.adapters.notifications.getPermission()) === 'granted' ? 'granted' : await this.adapters.notifications.requestPermission();
      if (permission === 'granted') {
        const notificationId = await this.adapters.notifications.schedule({ id: `${localId}-notif`, title: label, body: TIMER_DONE[this.language()], fireISO, categoryId: 'timer', data: { timerId: localId }, timeSensitive: true });
        record = record ? { ...record, notificationId } : { backend: 'notification', externalId: null, notificationId, canCancel: true, note };
      } else if (!record) throw new DomainError('NOTIFICATION_PERMISSION_DENIED');
    }
    const alarm = await this.services.alarms.create({ kind: 'timer', label, fireAt: fireISO, durationSeconds: seconds, recurrence: null, backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, canCancel: record.canCancel || Boolean(record.notificationId), captureId: capture.id });
    await this.services.captures.markProcessed(capture.id, { type: 'REMINDER', id: alarm.id }, 'REMINDER', label);
    const { summary, detail } = this.summary(command);
    const externalIds: Record<string, string> = {};
    if (record.externalId) externalIds.timerId = record.externalId;
    if (record.notificationId) externalIds.notificationId = record.notificationId;
    return { summary, detail, externalIds, plan: { kind: 'cancel_alarm', alarmId: alarm.id, record: { backend: record.backend, externalId: record.externalId, notificationId: record.notificationId, canCancel: record.canCancel } }, createdItem: { type: 'REMINDER', id: alarm.id }, payload: null, note };
  }

  private async resolveTask(query: string): Promise<Task> {
    const match = await this.services.tasks.findByQuery(query);
    if (!match.best) throw new DomainError('NOT_FOUND', `No open task matches "${query}"`);
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several tasks match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.title })) } });
    return match.best;
  }

  private async completeTask(command: CommandOf<'COMPLETE_TASK'>): Promise<HandlerOutcome> {
    const task = await this.resolveTask(command.targetQuery);
    const previous = { status: task.status, completedAt: task.completedAt };
    await this.services.tasks.complete(task.id);
    if (task.reminderNotificationId) await this.adapters.notifications.cancel(task.reminderNotificationId).catch(() => undefined);
    const label = t(this.language()).labels.COMPLETE_TASK;
    return { summary: `${label} · ${task.title}`, detail: [], externalIds: {}, plan: { kind: 'restore_task', taskId: task.id, previous }, createdItem: { type: 'TASK', id: task.id }, payload: null, note: null };
  }

  private async updateTask(command: CommandOf<'UPDATE_TASK'>): Promise<HandlerOutcome> {
    const task = await this.resolveTask(command.targetQuery);
    const previous: Partial<Task> = { title: task.title, dueDate: task.dueDate, dueTime: task.dueTime, dueAt: task.dueAt, priority: task.priority, status: task.status };
    let updated = task;
    if (command.changes.when) updated = await this.services.tasks.reschedule(task.id, command.changes.when);
    const patch: Partial<Task> = {};
    if (command.changes.title) patch.title = command.changes.title;
    if (command.changes.priority) patch.priority = command.changes.priority;
    if (command.changes.status) patch.status = command.changes.status;
    if (Object.keys(patch).length) updated = await this.services.tasks.update(task.id, patch);
    const label = t(this.language()).labels.UPDATE_TASK;
    const d = describeCommand({ ...command, targetQuery: updated.title }, this.language(), this.timezone(), this.now());
    return { summary: `${label} · ${updated.title}`, detail: d.lines, externalIds: {}, plan: { kind: 'restore_task', taskId: task.id, previous }, createdItem: { type: 'TASK', id: task.id }, payload: null, note: null };
  }

  private async resolveEvent(query: string, dateHint: string | null): Promise<{ title: string; externalId: string | null; mirror: CalendarEventMirror | null }> {
    const match = await this.services.events.findByQuery(query, this.adapters.calendar, dateHint);
    if (!match.best) throw new DomainError('NOT_FOUND', `No event matches "${query}"`);
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several events match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.externalId ?? c.item.mirror?.id ?? '', title: c.item.title })) } });
    return match.best;
  }

  private async updateEvent(command: CommandOf<'UPDATE_EVENT'>): Promise<HandlerOutcome> {
    const target = await this.resolveEvent(command.targetQuery, null);
    if (!target.externalId) throw new DomainError('EXTERNAL_ITEM_DELETED');
    const existing = await this.adapters.calendar.getEvent(target.externalId);
    if (!existing) throw new DomainError('EXTERNAL_ITEM_DELETED');
    const changes: Partial<CalendarEventInput> = {};
    if (command.changes.when?.iso) {
      const duration = DateTime.fromISO(existing.endISO).diff(DateTime.fromISO(existing.startISO), 'minutes').minutes;
      changes.startISO = command.changes.when.iso;
      changes.endISO = command.changes.when.endIso ?? DateTime.fromISO(command.changes.when.iso).plus({ minutes: command.changes.durationMinutes ?? duration }).toISO({ suppressMilliseconds: true }) ?? existing.endISO;
    }
    if (command.changes.title) changes.title = command.changes.title;
    if (command.changes.location) changes.location = command.changes.location;
    const record = await this.adapters.calendar.updateEvent(target.externalId, changes);
    const previous: Partial<CalendarEventMirror> = { title: existing.title, startAt: existing.startISO, endAt: existing.endISO, location: existing.location, notes: existing.notes };
    if (target.mirror) await this.services.events.update(target.mirror.id, { title: record.title, startAt: record.startISO, endAt: record.endISO, location: record.location });
    const label = t(this.language()).labels.UPDATE_EVENT;
    return { summary: `${label} · ${record.title}`, detail: [], externalIds: { eventId: record.externalId }, plan: target.mirror ? { kind: 'restore_event', eventId: target.mirror.id, externalId: target.externalId, previous } : { kind: 'none', reason: 'event not created by BrainVoice' }, createdItem: null, payload: null, note: null };
  }

  private async deleteEvent(command: CommandOf<'DELETE_EVENT'>): Promise<HandlerOutcome> {
    const target = await this.resolveEvent(command.targetQuery, command.when?.date ?? null);
    if (target.externalId) await this.adapters.calendar.deleteEvent(target.externalId);
    if (target.mirror) await this.services.events.markDeleted(target.mirror.id);
    const label = t(this.language()).labels.DELETE_EVENT;
    return { summary: `${label} · ${target.title}`, detail: [], externalIds: target.externalId ? { eventId: target.externalId } : {}, plan: target.mirror ? { kind: 'recreate_event', eventId: target.mirror.id, previous: target.mirror as unknown as Record<string, unknown> } : { kind: 'none', reason: 'event not created by BrainVoice' }, createdItem: null, payload: null, note: null };
  }

  private async searchNotes(command: CommandOf<'SEARCH_NOTES'>): Promise<HandlerOutcome> {
    const results = await this.services.search.search(command.query, { from: command.filters.from, to: command.filters.to, category: command.filters.category, person: command.filters.person, types: command.filters.types.length ? command.filters.types : undefined });
    const label = t(this.language()).labels.SEARCH_NOTES;
    return { summary: `${label} · ${command.query}`, detail: results.length ? [`${results.length}`] : [t(this.language()).noResults], externalIds: {}, plan: { kind: 'none', reason: 'query' }, createdItem: null, payload: { kind: 'search', query: command.query, results }, note: null };
  }

  private async getAgenda(command: CommandOf<'GET_AGENDA'>): Promise<HandlerOutcome> {
    const date = command.when?.date ?? (this.now().toISODate() ?? '');
    const agenda = await this.services.agenda.getRange(date, command.rangeDays);
    const label = t(this.language()).labels.GET_AGENDA;
    return { summary: `${label} · ${date}`, detail: [], externalIds: {}, plan: { kind: 'none', reason: 'query' }, createdItem: null, payload: { kind: 'agenda', agenda }, note: null };
  }

  private async getTasks(command: CommandOf<'GET_TASKS'>): Promise<HandlerOutcome> {
    const view = command.filter === 'date' ? 'date' : command.filter;
    const tasks = await this.services.tasks.list(view, command.filter === 'date' ? { date: command.when?.date ?? undefined } : {});
    const label = t(this.language()).labels.GET_TASKS;
    return { summary: `${label} · ${command.filter}`, detail: [], externalIds: {}, plan: { kind: 'none', reason: 'query' }, createdItem: null, payload: { kind: 'tasks', filter: command.filter, tasks }, note: null };
  }
}

// -----------------------------------------------------------------------------

function requireWhen(when: When | null): When {
  if (!when) throw new DomainError('VALIDATION_FAILED', 'Missing date/time');
  return when;
}

function isoFrom(when: When, zone: string): string | null {
  if (!when.date) return null;
  const time = when.time ?? '09:00';
  const dt = DateTime.fromISO(`${when.date}T${time}`, { zone });
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true }) : null;
}

function nextTimeOccurrence(hour: number, minute: number, now: DateTime, zone: string): DateTime {
  const today = now.setZone(zone).set({ hour, minute, second: 0, millisecond: 0 });
  return today > now ? today : today.plus({ days: 1 });
}

function crypto_id(): string {
  // Local helper to avoid importing the platform id generator in this file's hot path.
  const g = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return g?.randomUUID ? g.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export { dueFromWhen };
