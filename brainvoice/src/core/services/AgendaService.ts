import { DateTime } from 'luxon';

import type { Clock } from './Clock';
import type { EventService, ReminderService } from './ScheduleServices';
import type { TaskService } from './TaskService';
import type { CalendarAdapter } from '../commands/adapters';
import type { CalendarEventMirror, Reminder, Task } from '../domain/entities';

export interface AgendaEvent {
  id: string;
  externalId: string | null;
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location: string | null;
  /** 'calendar' = read from the device calendar, 'local' = our mirror only */
  source: 'calendar' | 'local';
}

export interface AgendaDay {
  date: string;
  events: AgendaEvent[];
  reminders: Reminder[];
  tasks: Task[];
}

export interface Agenda {
  fromDate: string;
  toDate: string;
  days: AgendaDay[];
  overdueTasks: Task[];
  inboxCount: number;
  calendarPermission: 'granted' | 'missing';
}

/** Builds the Today view and answers "what does my day look like". */
export class AgendaService {
  constructor(
    private readonly clock: Clock,
    private readonly events: EventService,
    private readonly reminders: ReminderService,
    private readonly tasks: TaskService,
    private readonly calendar: CalendarAdapter,
    private readonly inboxCount: () => Promise<number>,
  ) {}

  async getRange(fromDate: string, rangeDays = 1): Promise<Agenda> {
    const zone = this.clock.timezone();
    const from = DateTime.fromISO(fromDate, { zone }).startOf('day');
    const to = from.plus({ days: Math.max(1, rangeDays) });
    const fromISO = from.toISO() ?? '';
    const toISO = to.toISO() ?? '';

    let calendarPermission: 'granted' | 'missing' = 'missing';
    let events: AgendaEvent[] = [];
    try {
      if ((await this.calendar.getPermission()) === 'granted') {
        calendarPermission = 'granted';
        const records = await this.calendar.listEvents(fromISO, toISO);
        events = records.map((r) => ({ id: r.externalId, externalId: r.externalId, title: r.title, startISO: r.startISO, endISO: r.endISO, allDay: r.allDay, location: r.location, source: 'calendar' as const }));
      }
    } catch {
      calendarPermission = 'missing';
    }
    if (calendarPermission === 'missing') {
      const mirrors = await this.events.listBetween(fromISO, toISO);
      events = mirrors.map(mirrorToAgendaEvent);
    }

    const reminders = await this.reminders.listBetween(fromISO, toISO);
    const today = this.clock.today();
    const includesToday = fromDate <= today && to.toISODate()! > today;
    const overdueTasks = includesToday ? await this.tasks.list('overdue') : [];

    const days: AgendaDay[] = [];
    for (let i = 0; i < Math.max(1, rangeDays); i++) {
      const day = from.plus({ days: i });
      const date = day.toISODate() ?? fromDate;
      const dayStart = day.toISO() ?? '';
      const dayEnd = day.plus({ days: 1 }).toISO() ?? '';
      const dayTasks = date === today ? await this.tasks.list('today') : await this.tasks.list('date', { date });
      days.push({
        date,
        events: events.filter((e) => e.startISO < dayEnd && e.endISO > dayStart).sort((a, b) => a.startISO.localeCompare(b.startISO)),
        reminders: reminders.filter((r) => r.dueAt >= dayStart && r.dueAt < dayEnd),
        tasks: date === today ? dayTasks.filter((t) => t.dueDate === today || !t.dueDate || t.dueDate >= today) : dayTasks,
      });
    }

    return { fromDate, toDate: to.minus({ days: 1 }).toISODate() ?? fromDate, days, overdueTasks, inboxCount: await this.inboxCount(), calendarPermission };
  }

  getToday(): Promise<Agenda> {
    return this.getRange(this.clock.today(), 1);
  }
}

function mirrorToAgendaEvent(m: CalendarEventMirror): AgendaEvent {
  return { id: m.id, externalId: m.externalId, title: m.title, startISO: m.startAt, endISO: m.endAt, allDay: m.allDay, location: m.location, source: 'local' };
}
