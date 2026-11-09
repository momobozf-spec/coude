import { DateTime } from 'luxon';

import type { ClockTime, ISODate, Language, Recurrence } from '../types/common';

const LOCALE: Record<Language, string> = { en: 'en-GB', nl: 'nl-BE', fr: 'fr-BE' };

const RELATIVE: Record<Language, { today: string; tomorrow: string; yesterday: string; dayAfter: string }> = {
  en: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', dayAfter: 'Day after tomorrow' },
  nl: { today: 'Vandaag', tomorrow: 'Morgen', yesterday: 'Gisteren', dayAfter: 'Overmorgen' },
  fr: { today: "Aujourd'hui", tomorrow: 'Demain', yesterday: 'Hier', dayAfter: 'Après-demain' },
};

const EVERY: Record<Language, string> = { en: 'Every', nl: 'Elke', fr: 'Chaque' };
const WEEKDAYS_LABEL: Record<Language, string> = { en: 'weekday', nl: 'werkdag', fr: 'jour de semaine' };
const DAY_LABEL: Record<Language, string> = { en: 'day', nl: 'dag', fr: 'jour' };
const WEEK_LABEL: Record<Language, string> = { en: 'week', nl: 'week', fr: 'semaine' };
const MONTH_LABEL: Record<Language, string> = { en: 'month', nl: 'maand', fr: 'mois' };

/** "Tomorrow", "Fri 25 Sep", "Mon 28 Sep 2027" relative to now, localised. */
export function formatDate(date: ISODate, language: Language, timezone: string, now: DateTime = DateTime.now().setZone(timezone)): string {
  const dt = DateTime.fromISO(date, { zone: timezone });
  if (!dt.isValid) return date;
  const diffDays = Math.round(dt.startOf('day').diff(now.startOf('day'), 'days').days);
  const rel = RELATIVE[language];
  if (diffDays === 0) return rel.today;
  if (diffDays === 1) return rel.tomorrow;
  if (diffDays === 2) return rel.dayAfter;
  if (diffDays === -1) return rel.yesterday;
  const sameYear = dt.year === now.year;
  return dt.setLocale(LOCALE[language]).toFormat(sameYear ? 'ccc d LLL' : 'ccc d LLL yyyy');
}

export function formatTime(time: ClockTime): string {
  return time;
}

export function formatDateTime(
  date: ISODate | null,
  time: ClockTime | null,
  language: Language,
  timezone: string,
  now?: DateTime,
): string {
  const parts: string[] = [];
  if (date) parts.push(formatDate(date, language, timezone, now));
  if (time) parts.push(formatTime(time));
  return parts.join(' · ');
}

export function formatTimeRange(start: ClockTime, end: ClockTime | null): string {
  return end ? `${start} – ${end}` : start;
}

export function formatRecurrence(recurrence: Recurrence, language: Language): string {
  const every = EVERY[language];
  const locale = LOCALE[language];
  if (recurrence.frequency === 'DAILY') return `${every} ${DAY_LABEL[language]}`;
  if (recurrence.frequency === 'WEEKLY') {
    const days = recurrence.byWeekday ?? [];
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d as 1))) return `${every} ${WEEKDAYS_LABEL[language]}`;
    if (days.length === 0) return `${every} ${WEEK_LABEL[language]}`;
    const names = days.map((d) => DateTime.fromObject({ weekday: d }).setLocale(locale).toFormat('cccc'));
    return `${every} ${names.join(', ')}`;
  }
  if (recurrence.frequency === 'MONTHLY') return `${every} ${MONTH_LABEL[language]}`;
  return `${every} ${language === 'en' ? 'year' : language === 'nl' ? 'jaar' : 'année'}`;
}

export function formatDuration(minutes: number, language: Language): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourUnit = language === 'fr' ? 'h' : language === 'nl' ? 'u' : 'h';
  const minUnit = 'min';
  if (h && m) return `${h}${hourUnit} ${m}${minUnit}`;
  if (h) return `${h}${hourUnit}`;
  return `${m} ${minUnit}`;
}

export function greetingFor(hour: number, language: Language, name?: string | null): string {
  const key = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const table: Record<Language, Record<typeof key, string>> = {
    en: { night: 'Good night', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    nl: { night: 'Goedenacht', morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond' },
    fr: { night: 'Bonne nuit', morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir' },
  };
  const base = table[language][key];
  return name ? `${base}, ${name}` : base;
}

export function formatLongDate(date: DateTime, language: Language): string {
  return date.setLocale(LOCALE[language]).toFormat('cccc d LLLL').toUpperCase();
}
