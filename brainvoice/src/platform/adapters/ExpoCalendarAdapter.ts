import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type { CalendarAdapter, CalendarEventInput, CalendarEventRecord, PermissionState } from '@core/commands/adapters';
import { DomainError, type Recurrence } from '@core/types/common';

/**
 * CalendarAdapter on expo-calendar: EventKit on iOS, CalendarContract on Android.
 * Events are created in the user's default writable calendar (configurable).
 */

export function mapPermissionStatus(status: string): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

function toDate(value: string | Date | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** ISO weekday (1 = Monday … 7 = Sunday) → EventKit DayOfTheWeek (Sunday = 1 … Saturday = 7). */
function toEventKitWeekday(iso: number): Calendar.DayOfTheWeek {
  return (iso === 7 ? 1 : iso + 1) as Calendar.DayOfTheWeek;
}

export function toRecurrenceRule(recurrence: Recurrence | null): Calendar.RecurrenceRule | null {
  if (!recurrence) return null;
  const frequency: Record<Recurrence['frequency'], Calendar.Frequency> = {
    DAILY: Calendar.Frequency.DAILY,
    WEEKLY: Calendar.Frequency.WEEKLY,
    MONTHLY: Calendar.Frequency.MONTHLY,
    YEARLY: Calendar.Frequency.YEARLY,
  };
  const rule: Calendar.RecurrenceRule = { frequency: frequency[recurrence.frequency], interval: recurrence.interval };
  if (recurrence.byWeekday?.length) rule.daysOfTheWeek = recurrence.byWeekday.map((d) => ({ dayOfTheWeek: toEventKitWeekday(d) }));
  if (recurrence.until) rule.endDate = new Date(`${recurrence.until}T23:59:59`).toISOString();
  return rule;
}

function toRecord(event: Calendar.ExpoCalendarEvent): CalendarEventRecord {
  return {
    externalId: event.id,
    calendarId: event.calendarId ?? null,
    title: event.title,
    startISO: toDate(event.startDate),
    endISO: toDate(event.endDate),
    allDay: Boolean(event.allDay),
    location: event.location ?? null,
    notes: event.notes ?? null,
  };
}

export class ExpoCalendarAdapter implements CalendarAdapter {
  readonly id = Platform.OS === 'ios' ? 'ios-eventkit' : 'android-calendar-provider';
  private preferredCalendarId: string | null = null;

  setPreferredCalendar(id: string | null): void {
    this.preferredCalendarId = id;
  }

  async getPermission(): Promise<PermissionState> {
    const result = await Calendar.getCalendarPermissions();
    return mapPermissionStatus(result.status);
  }

  async requestPermission(): Promise<PermissionState> {
    const result = await Calendar.requestCalendarPermissions();
    return mapPermissionStatus(result.status);
  }

  async listWritableCalendars(): Promise<{ id: string; title: string; isPrimary: boolean }[]> {
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    return calendars.filter((c) => c.allowsModifications).map((c) => ({ id: c.id, title: c.title, isPrimary: Boolean(c.isPrimary) }));
  }

  private async writableCalendar(): Promise<Calendar.ExpoCalendar> {
    if (this.preferredCalendarId) {
      try {
        const preferred = await Calendar.ExpoCalendar.get(this.preferredCalendarId);
        if (preferred.allowsModifications) return preferred;
      } catch {
        this.preferredCalendarId = null;
      }
    }
    if (Platform.OS === 'ios') {
      try {
        const def = Calendar.getDefaultCalendarSync();
        if (def.allowsModifications) return def;
      } catch {
        // fall through to the generic lookup
      }
    }
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const chosen = calendars.find((c) => c.isPrimary && c.allowsModifications) ?? calendars.find((c) => c.allowsModifications);
    if (!chosen) throw new DomainError('CALENDAR_PERMISSION_DENIED', 'No writable calendar found on this device');
    return chosen;
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEventRecord> {
    const calendar = await this.writableCalendar();
    const event = await calendar.createEvent({
      title: input.title,
      startDate: new Date(input.startISO),
      endDate: new Date(input.endISO),
      allDay: input.allDay,
      location: input.location,
      notes: input.notes ?? '',
      alarms: input.alerts.map((a) => ({ relativeOffset: a.offsetMinutes })),
      recurrenceRule: toRecurrenceRule(input.recurrence),
      timeZone: input.timezone,
    });
    return toRecord(event);
  }

  async updateEvent(externalId: string, changes: Partial<CalendarEventInput>): Promise<CalendarEventRecord> {
    let event: Calendar.ExpoCalendarEvent;
    try {
      event = await Calendar.ExpoCalendarEvent.get(externalId);
    } catch (e) {
      throw new DomainError('EXTERNAL_ITEM_DELETED', 'The calendar event no longer exists', { cause: e });
    }
    await event.update({
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.startISO !== undefined ? { startDate: new Date(changes.startISO) } : {}),
      ...(changes.endISO !== undefined ? { endDate: new Date(changes.endISO) } : {}),
      ...(changes.allDay !== undefined ? { allDay: changes.allDay } : {}),
      ...(changes.location !== undefined ? { location: changes.location } : {}),
      ...(changes.notes !== undefined ? { notes: changes.notes ?? '' } : {}),
      ...(changes.alerts !== undefined ? { alarms: changes.alerts.map((a) => ({ relativeOffset: a.offsetMinutes })) } : {}),
      ...(changes.recurrence !== undefined ? { recurrenceRule: toRecurrenceRule(changes.recurrence) } : {}),
    });
    return toRecord(await Calendar.ExpoCalendarEvent.get(externalId));
  }

  async deleteEvent(externalId: string): Promise<void> {
    try {
      const event = await Calendar.ExpoCalendarEvent.get(externalId);
      await event.delete();
    } catch (e) {
      throw new DomainError('EXTERNAL_ITEM_DELETED', 'The calendar event no longer exists', { cause: e });
    }
  }

  async getEvent(externalId: string): Promise<CalendarEventRecord | null> {
    try {
      return toRecord(await Calendar.ExpoCalendarEvent.get(externalId));
    } catch {
      return null;
    }
  }

  async listEvents(fromISO: string, toISO: string): Promise<CalendarEventRecord[]> {
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) return [];
    const events = await Calendar.listEvents(calendars, new Date(fromISO), new Date(toISO));
    return events.map(toRecord).sort((a, b) => a.startISO.localeCompare(b.startISO));
  }
}
