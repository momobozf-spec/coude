import { DateTime } from 'luxon';

import type { Clock } from './Clock';
import type { CalendarAdapter, CalendarEventRecord } from '../commands/adapters';
import { findBestMatch, type MatchResult } from '../commands/matching';
import type { Database } from '../db/Database';
import type { Alarm, AlarmBackend, CalendarEventMirror, Reminder, ReminderBackend } from '../domain/entities';
import { DomainError, type Recurrence } from '../types/common';
import { newId } from '../util/id';

/** Local mirror of calendar events we created; the calendar app remains the source of truth. */
export class EventService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: Omit<CalendarEventMirror, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CalendarEventMirror> {
    const now = this.clock.nowISO();
    const event: CalendarEventMirror = { ...input, id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
    await this.db.events.insert(event);
    await this.db.search.index({ itemId: event.id, itemType: 'EVENT', title: event.title, content: event.notes ?? '', tags: [], people: event.people });
    return event;
  }

  async update(id: string, patch: Partial<CalendarEventMirror>): Promise<CalendarEventMirror> {
    const event = await this.db.events.getById(id);
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
    const next = { ...event, ...patch, updatedAt: this.clock.nowISO() };
    await this.db.events.update(next);
    return next;
  }

  async markDeleted(id: string): Promise<void> {
    const event = await this.db.events.getById(id);
    if (!event) return;
    await this.db.events.update({ ...event, deletedAt: this.clock.nowISO(), updatedAt: this.clock.nowISO() });
    await this.db.search.remove(id);
  }

  async restore(id: string): Promise<void> {
    const event = await this.db.events.getById(id);
    if (!event) return;
    await this.db.events.update({ ...event, deletedAt: null, updatedAt: this.clock.nowISO() });
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.events.delete(id);
    await this.db.search.remove(id);
  }

  getById(id: string): Promise<CalendarEventMirror | null> {
    return this.db.events.getById(id);
  }

  listBetween(fromISO: string, toISO: string): Promise<CalendarEventMirror[]> {
    return this.db.events.listBetween(fromISO, toISO);
  }

  /**
   * Finds an event by spoken description. Looks in the device calendar when the
   * adapter has permission (upcoming 60 days), otherwise in the local mirror.
   */
  async findByQuery(query: string, calendar: CalendarAdapter | null, dateHint: string | null): Promise<MatchResult<{ title: string; externalId: string | null; mirror: CalendarEventMirror | null; record: CalendarEventRecord | null }>> {
    const now = this.clock.now();
    const from = dateHint ? DateTime.fromISO(dateHint, { zone: this.clock.timezone() }).startOf('day') : now.startOf('day');
    const to = dateHint ? from.endOf('day') : now.plus({ days: 60 });
    const candidates: { title: string; externalId: string | null; mirror: CalendarEventMirror | null; record: CalendarEventRecord | null }[] = [];
    if (calendar && (await calendar.getPermission()) === 'granted') {
      const records = await calendar.listEvents(from.toISO() ?? '', to.toISO() ?? '');
      for (const record of records) {
        const mirror = await this.db.events.getByExternalId(record.externalId);
        candidates.push({ title: record.title, externalId: record.externalId, mirror, record });
      }
    } else {
      const mirrors = await this.db.events.listBetween(from.toISO() ?? '', to.toISO() ?? '');
      for (const mirror of mirrors) candidates.push({ title: mirror.title, externalId: mirror.externalId, mirror, record: null });
    }
    return findBestMatch(query, candidates, (c) => c.title);
  }
}

export class ReminderService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: { title: string; notes: string | null; dueAt: string; recurrence: Recurrence | null; backend: ReminderBackend; externalId: string | null; notificationId: string | null; captureId: string | null }): Promise<Reminder> {
    const now = this.clock.nowISO();
    const reminder: Reminder = { ...input, id: newId(), completedAt: null, createdAt: now, updatedAt: now };
    await this.db.reminders.insert(reminder);
    await this.db.search.index({ itemId: reminder.id, itemType: 'REMINDER', title: reminder.title, content: reminder.notes ?? '', tags: [], people: [] });
    return reminder;
  }

  async update(id: string, patch: Partial<Reminder>): Promise<Reminder> {
    const reminder = await this.db.reminders.getById(id);
    if (!reminder) throw new DomainError('NOT_FOUND', 'Reminder not found');
    const next = { ...reminder, ...patch, updatedAt: this.clock.nowISO() };
    await this.db.reminders.update(next);
    return next;
  }

  async complete(id: string): Promise<Reminder> {
    return this.update(id, { completedAt: this.clock.nowISO() });
  }

  async delete(id: string): Promise<void> {
    await this.db.reminders.delete(id);
    await this.db.search.remove(id);
  }

  getById(id: string): Promise<Reminder | null> {
    return this.db.reminders.getById(id);
  }

  listBetween(fromISO: string, toISO: string): Promise<Reminder[]> {
    return this.db.reminders.listBetween(fromISO, toISO);
  }

  listOpen(): Promise<Reminder[]> {
    return this.db.reminders.listOpen();
  }

  async findByQuery(query: string): Promise<MatchResult<Reminder>> {
    const open = await this.db.reminders.listOpen();
    return findBestMatch(query, open, (r) => r.title);
  }
}

export class AlarmService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: { kind: 'alarm' | 'timer'; label: string | null; fireAt: string | null; durationSeconds: number | null; recurrence: Recurrence | null; backend: AlarmBackend; externalId: string | null; notificationId: string | null; canCancel: boolean; captureId: string | null }): Promise<Alarm> {
    const now = this.clock.nowISO();
    const alarm: Alarm = { ...input, id: newId(), status: 'scheduled', createdAt: now, updatedAt: now };
    await this.db.alarms.insert(alarm);
    return alarm;
  }

  async setStatus(id: string, status: Alarm['status']): Promise<Alarm> {
    const alarm = await this.db.alarms.getById(id);
    if (!alarm) throw new DomainError('NOT_FOUND', 'Alarm not found');
    const next = { ...alarm, status, updatedAt: this.clock.nowISO() };
    await this.db.alarms.update(next);
    return next;
  }

  getById(id: string): Promise<Alarm | null> {
    return this.db.alarms.getById(id);
  }

  listScheduled(): Promise<Alarm[]> {
    return this.db.alarms.listScheduled();
  }

  async delete(id: string): Promise<void> {
    await this.db.alarms.delete(id);
  }
}
