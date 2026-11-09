import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../SqlDriver';
import type { Alarm, AlarmBackend, AlarmStatus, CalendarEventMirror, Reminder, ReminderBackend } from '../../domain/entities';
import type { Recurrence } from '../../types/common';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Events (local mirror of calendar items we created)
// ---------------------------------------------------------------------------

function rowToEvent(r: Row): CalendarEventMirror {
  return {
    id: String(r.id),
    captureId: nullable(r.capture_id),
    title: String(r.title),
    startAt: String(r.start_at),
    endAt: String(r.end_at),
    allDay: toBool(r.all_day),
    location: nullable(r.location),
    notes: nullable(r.notes),
    calendarId: nullable(r.calendar_id),
    externalId: nullable(r.external_id),
    alerts: parseJson<{ offsetMinutes: number }[]>(r.alerts_json, []),
    recurrence: parseJson<Recurrence | null>(r.recurrence_json, null),
    people: parseJson<string[]>(r.people_json, []),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    deletedAt: nullable(r.deleted_at),
  };
}

export class EventRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: CalendarEventMirror): Promise<void> {
    await this.db.run(
      `INSERT INTO events (id, capture_id, title, start_at, end_at, all_day, location, notes, calendar_id, external_id, alerts_json, recurrence_json, people_json, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.captureId, e.title, e.startAt, e.endAt, fromBool(e.allDay), e.location, e.notes, e.calendarId, e.externalId, toJson(e.alerts), e.recurrence ? toJson(e.recurrence) : null, toJson(e.people), e.createdAt, e.updatedAt, e.deletedAt],
    );
  }

  async update(e: CalendarEventMirror): Promise<void> {
    await this.db.run(
      `UPDATE events SET title = ?, start_at = ?, end_at = ?, all_day = ?, location = ?, notes = ?, calendar_id = ?, external_id = ?, alerts_json = ?, recurrence_json = ?, people_json = ?, updated_at = ?, deleted_at = ? WHERE id = ?`,
      [e.title, e.startAt, e.endAt, fromBool(e.allDay), e.location, e.notes, e.calendarId, e.externalId, toJson(e.alerts), e.recurrence ? toJson(e.recurrence) : null, toJson(e.people), e.updatedAt, e.deletedAt, e.id],
    );
  }

  async getById(id: string): Promise<CalendarEventMirror | null> {
    const row = await this.db.get<Row>('SELECT * FROM events WHERE id = ?', [id]);
    return row ? rowToEvent(row) : null;
  }

  async getByExternalId(externalId: string): Promise<CalendarEventMirror | null> {
    const row = await this.db.get<Row>('SELECT * FROM events WHERE external_id = ? AND deleted_at IS NULL', [externalId]);
    return row ? rowToEvent(row) : null;
  }

  async listBetween(fromISO: string, toISO: string): Promise<CalendarEventMirror[]> {
    const rows = await this.db.all<Row>('SELECT * FROM events WHERE deleted_at IS NULL AND start_at < ? AND end_at > ? ORDER BY start_at ASC', [toISO, fromISO]);
    return rows.map(rowToEvent);
  }

  async listUpcoming(fromISO: string, limit = 200): Promise<CalendarEventMirror[]> {
    const rows = await this.db.all<Row>('SELECT * FROM events WHERE deleted_at IS NULL AND end_at >= ? ORDER BY start_at ASC LIMIT ?', [fromISO, limit]);
    return rows.map(rowToEvent);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM events WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

function rowToReminder(r: Row): Reminder {
  return {
    id: String(r.id),
    captureId: nullable(r.capture_id),
    title: String(r.title),
    notes: nullable(r.notes),
    dueAt: String(r.due_at),
    recurrence: parseJson<Recurrence | null>(r.recurrence_json, null),
    backend: String(r.backend) as ReminderBackend,
    externalId: nullable(r.external_id),
    notificationId: nullable(r.notification_id),
    completedAt: nullable(r.completed_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class ReminderRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(r: Reminder): Promise<void> {
    await this.db.run(
      `INSERT INTO reminders (id, capture_id, title, notes, due_at, recurrence_json, backend, external_id, notification_id, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.captureId, r.title, r.notes, r.dueAt, r.recurrence ? toJson(r.recurrence) : null, r.backend, r.externalId, r.notificationId, r.completedAt, r.createdAt, r.updatedAt],
    );
  }

  async update(r: Reminder): Promise<void> {
    await this.db.run(
      `UPDATE reminders SET title = ?, notes = ?, due_at = ?, recurrence_json = ?, backend = ?, external_id = ?, notification_id = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
      [r.title, r.notes, r.dueAt, r.recurrence ? toJson(r.recurrence) : null, r.backend, r.externalId, r.notificationId, r.completedAt, r.updatedAt, r.id],
    );
  }

  async getById(id: string): Promise<Reminder | null> {
    const row = await this.db.get<Row>('SELECT * FROM reminders WHERE id = ?', [id]);
    return row ? rowToReminder(row) : null;
  }

  async listBetween(fromISO: string, toISO: string): Promise<Reminder[]> {
    const rows = await this.db.all<Row>('SELECT * FROM reminders WHERE completed_at IS NULL AND due_at >= ? AND due_at < ? ORDER BY due_at ASC', [fromISO, toISO]);
    return rows.map(rowToReminder);
  }

  async listOpen(limit = 200): Promise<Reminder[]> {
    const rows = await this.db.all<Row>('SELECT * FROM reminders WHERE completed_at IS NULL ORDER BY due_at ASC LIMIT ?', [limit]);
    return rows.map(rowToReminder);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Alarms & timers
// ---------------------------------------------------------------------------

function rowToAlarm(r: Row): Alarm {
  return {
    id: String(r.id),
    captureId: nullable(r.capture_id),
    kind: String(r.kind) as 'alarm' | 'timer',
    label: nullable(r.label),
    fireAt: nullable(r.fire_at),
    durationSeconds: numberOrNull(r.duration_seconds),
    recurrence: parseJson<Recurrence | null>(r.recurrence_json, null),
    backend: String(r.backend) as AlarmBackend,
    externalId: nullable(r.external_id),
    notificationId: nullable(r.notification_id),
    canCancel: toBool(r.can_cancel),
    status: String(r.status) as AlarmStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class AlarmRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(a: Alarm): Promise<void> {
    await this.db.run(
      `INSERT INTO alarms (id, capture_id, kind, label, fire_at, duration_seconds, recurrence_json, backend, external_id, notification_id, can_cancel, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.captureId, a.kind, a.label, a.fireAt, a.durationSeconds, a.recurrence ? toJson(a.recurrence) : null, a.backend, a.externalId, a.notificationId, fromBool(a.canCancel), a.status, a.createdAt, a.updatedAt],
    );
  }

  async update(a: Alarm): Promise<void> {
    await this.db.run(`UPDATE alarms SET label = ?, fire_at = ?, duration_seconds = ?, external_id = ?, notification_id = ?, can_cancel = ?, status = ?, updated_at = ? WHERE id = ?`, [
      a.label, a.fireAt, a.durationSeconds, a.externalId, a.notificationId, fromBool(a.canCancel), a.status, a.updatedAt, a.id,
    ]);
  }

  async getById(id: string): Promise<Alarm | null> {
    const row = await this.db.get<Row>('SELECT * FROM alarms WHERE id = ?', [id]);
    return row ? rowToAlarm(row) : null;
  }

  async listScheduled(limit = 100): Promise<Alarm[]> {
    const rows = await this.db.all<Row>("SELECT * FROM alarms WHERE status = 'scheduled' ORDER BY created_at DESC LIMIT ?", [limit]);
    return rows.map(rowToAlarm);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM alarms WHERE id = ?', [id]);
  }
}
