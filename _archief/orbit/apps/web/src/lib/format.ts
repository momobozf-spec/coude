import { describeRelativeDate, differenceInDays, parseIsoDate } from '@orbit/utils';
import type { IsoDate, Priority } from '@orbit/types';

/** Nederlandse weergave van datums, prioriteiten en duur. */

const MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const WEEKDAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

export function formatDate(date: IsoDate, options: { short?: boolean; year?: boolean } = {}): string {
  const { year, month, day } = parseIsoDate(date);
  const monthName = options.short ? MONTHS_SHORT[month - 1] : MONTHS[month - 1];
  const currentYear = new Date().getUTCFullYear();
  return options.year || year !== currentYear
    ? `${day} ${monthName} ${year}`
    : `${day} ${monthName}`;
}

export function weekdayOf(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '';
}

/**
 * "Vandaag", "Morgen", "vrijdag", of een datum. Binnen een week de weekdag:
 * dat leest sneller dan "over 3 dagen" als je je week aan het plannen bent.
 */
export function formatDueDate(date: IsoDate, today: IsoDate): string {
  const relative = describeRelativeDate(date, today);
  switch (relative.key) {
    case 'today':
      return 'Vandaag';
    case 'tomorrow':
      return 'Morgen';
    case 'yesterday':
      return 'Gisteren';
    case 'overdue': {
      const days = Math.abs(relative.daysFromToday);
      return days <= 7 ? `${days} ${days === 1 ? 'dag' : 'dagen'} te laat` : formatDate(date, { short: true });
    }
    case 'thisWeek':
      return weekdayOf(date);
    case 'nextWeek':
      return `volgende week ${weekdayOf(date)}`;
    default:
      return formatDate(date, { short: true });
  }
}

export function isOverdueDate(date: IsoDate, today: IsoDate): boolean {
  return differenceInDays(today, date) < 0;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'Hoog',
  MEDIUM: 'Normaal',
  LOW: 'Laag',
  NONE: 'Geen',
};

export const PRIORITY_CLASSES: Record<Priority, string> = {
  URGENT: 'text-priority-urgent',
  HIGH: 'text-priority-high',
  MEDIUM: 'text-priority-medium',
  LOW: 'text-priority-low',
  NONE: 'text-priority-none',
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} uur` : `${hours}u${String(rest).padStart(2, '0')}`;
}

export function formatTime(time: string): string {
  return time;
}

/** "3 van 5" voor checklists en subtaken. */
export function formatProgress(done: number, total: number): string {
  return `${done} van ${total}`;
}
