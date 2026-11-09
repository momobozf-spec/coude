import {
  RecurrenceAnchor,
  RecurrenceFreq,
  WORKDAYS,
  type IsoDate,
  type RecurrenceRule,
  type Weekday,
} from '@orbit/types';
import {
  addDays,
  addMonths,
  addYears,
  compareIsoDates,
  dayOfWeek,
  daysInMonth,
  formatIsoDate,
  parseIsoDate,
  startOfWeek,
} from '@orbit/utils';

/**
 * Herhalende taken.
 *
 * Twee ankers, met wezenlijk ander gedrag:
 * - SCHEDULE: de reeks ligt vast vanaf de startdatum. "Elke maandag" blijft
 *   maandag, ook als je er drie weken niet naar omkijkt.
 * - COMPLETION: de volgende keer wordt vanaf het afvinken geteld. "Elke 3 dagen
 *   de planten water geven" schuift mee met je werkelijke gedrag.
 *
 * Dat onderscheid is precies waar Todoist (`every!`) en TickTick verschillen;
 * we ondersteunen ze allebei expliciet in plaats van er één te kiezen.
 */

const MAX_ITERATIONS = 10_000;
const WEEKDAY_INDEX: Readonly<Record<Weekday, number>> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function weekdayOf(date: IsoDate): Weekday {
  const index = dayOfWeek(date);
  return (Object.keys(WEEKDAY_INDEX) as Weekday[]).find(
    (day) => WEEKDAY_INDEX[day] === index,
  ) as Weekday;
}

function sortedWeekdays(days: readonly Weekday[]): Weekday[] {
  return [...days].sort((a, b) => WEEKDAY_INDEX[a] - WEEKDAY_INDEX[b]);
}

/** Zet een dag-van-de-maand om naar een echte dag; negatief telt vanaf achteren. */
function resolveMonthDay(year: number, month: number, monthDay: number): IsoDate | null {
  const total = daysInMonth(year, month);
  const day = monthDay > 0 ? monthDay : total + monthDay + 1;
  if (day < 1 || day > total) return null; // 31 februari bestaat niet: overslaan.
  return formatIsoDate({ year, month, day });
}

/**
 * De ruwe reeks datums die het patroon oplevert, zonder naar `until` of `count`
 * te kijken. Oneindig van zichzelf; de aanroeper begrenst.
 */
function* candidateDates(rule: RecurrenceRule, start: IsoDate): Generator<IsoDate> {
  const interval = Math.max(1, Math.trunc(rule.interval));

  switch (rule.freq) {
    case RecurrenceFreq.Daily: {
      let cursor = start;
      for (let guard = 0; guard < MAX_ITERATIONS; guard++) {
        yield cursor;
        cursor = addDays(cursor, interval);
      }
      return;
    }

    case RecurrenceFreq.Weekly: {
      const weekdays = rule.byWeekday?.length ? sortedWeekdays(rule.byWeekday) : [weekdayOf(start)];
      let weekAnchor = startOfWeek(start, 1);
      for (let guard = 0; guard < MAX_ITERATIONS; guard++) {
        for (const weekday of weekdays) {
          // startOfWeek zet maandag op positie 0.
          const date = addDays(weekAnchor, (WEEKDAY_INDEX[weekday] + 6) % 7);
          if (compareIsoDates(date, start) >= 0) yield date;
        }
        weekAnchor = addDays(weekAnchor, 7 * interval);
      }
      return;
    }

    case RecurrenceFreq.Monthly: {
      const { day: startDay } = parseIsoDate(start);
      const monthDays = rule.byMonthDay?.length
        ? [...rule.byMonthDay].sort((a, b) => a - b)
        : [startDay];
      let monthCursor = start;
      for (let guard = 0; guard < MAX_ITERATIONS; guard++) {
        const { year, month } = parseIsoDate(monthCursor);
        for (const monthDay of monthDays) {
          const date = resolveMonthDay(year, month, monthDay);
          // Bestaat de dag niet in deze maand (31 februari), dan slaan we hem
          // over in plaats van te schuiven: dat is ook wat RFC 5545 voorschrijft.
          if (date && compareIsoDates(date, start) >= 0) yield date;
        }
        monthCursor = addMonths(monthCursor, interval);
      }
      return;
    }

    case RecurrenceFreq.Yearly: {
      const { month: startMonth, day: startDay } = parseIsoDate(start);
      const months = rule.byMonth?.length ? [...rule.byMonth].sort((a, b) => a - b) : [startMonth];
      let yearCursor = start;
      for (let guard = 0; guard < MAX_ITERATIONS; guard++) {
        const { year } = parseIsoDate(yearCursor);
        for (const month of months) {
          const date = resolveMonthDay(year, month, startDay);
          if (date && compareIsoDates(date, start) >= 0) yield date;
        }
        yearCursor = addYears(yearCursor, interval);
      }
      return;
    }
  }
}

/**
 * Alle voorkomens vanaf `start`, in oplopende volgorde, met `until` en `count`
 * toegepast. Alleen zinvol voor het SCHEDULE-anker.
 */
export function* iterateOccurrences(
  rule: RecurrenceRule,
  start: IsoDate,
  maxResults = MAX_ITERATIONS,
): Generator<IsoDate> {
  let emitted = 0;
  for (const date of candidateDates(rule, start)) {
    if (rule.until && compareIsoDates(date, rule.until) > 0) return;
    if (rule.count !== undefined && emitted >= rule.count) return;
    if (emitted >= maxResults) return;
    emitted++;
    yield date;
  }
}

/** Het eerste voorkomen strikt ná `after`. `null` als de reeks is afgelopen. */
export function nextScheduledOccurrence(
  rule: RecurrenceRule,
  start: IsoDate,
  after: IsoDate,
): IsoDate | null {
  for (const date of iterateOccurrences(rule, start)) {
    if (compareIsoDates(date, after) > 0) return date;
  }
  return null;
}

/** Telt vanaf het moment van afvinken in plaats van vanaf het schema. */
export function nextCompletionOccurrence(
  rule: RecurrenceRule,
  completedOn: IsoDate,
): IsoDate | null {
  const interval = Math.max(1, Math.trunc(rule.interval));
  let next: IsoDate;
  switch (rule.freq) {
    case RecurrenceFreq.Daily:
      next = addDays(completedOn, interval);
      break;
    case RecurrenceFreq.Weekly:
      next = addDays(completedOn, 7 * interval);
      break;
    case RecurrenceFreq.Monthly:
      next = addMonths(completedOn, interval);
      break;
    case RecurrenceFreq.Yearly:
      next = addYears(completedOn, interval);
      break;
  }
  if (rule.until && compareIsoDates(next, rule.until) > 0) return null;
  return next;
}

/**
 * De volgende deadline nadat een herhalende taak is afgevinkt.
 * Dit is de enige functie die de takenlogica hoeft aan te roepen.
 */
export function nextOccurrenceAfterCompletion(
  rule: RecurrenceRule,
  originalDueDate: IsoDate,
  completedOn: IsoDate,
): IsoDate | null {
  if (rule.anchor === RecurrenceAnchor.Completion) {
    return nextCompletionOccurrence(rule, completedOn);
  }
  // Bij het schema-anker slaan we gemiste voorkomens over: als je een dagelijkse
  // taak een week vergeet, sta je morgen weer op nul en niet zeven keer achter.
  const reference = compareIsoDates(completedOn, originalDueDate) > 0 ? completedOn : originalDueDate;
  return nextScheduledOccurrence(rule, originalDueDate, reference);
}

/** Alle voorkomens binnen een venster; gebruikt door de kalenderweergave. */
export function occurrencesInRange(
  rule: RecurrenceRule,
  start: IsoDate,
  from: IsoDate,
  to: IsoDate,
  limit = 500,
): IsoDate[] {
  const results: IsoDate[] = [];
  for (const date of iterateOccurrences(rule, start)) {
    if (compareIsoDates(date, to) > 0) break;
    if (compareIsoDates(date, from) >= 0) results.push(date);
    if (results.length >= limit) break;
  }
  return results;
}

export function isRuleFinished(rule: RecurrenceRule, start: IsoDate, after: IsoDate): boolean {
  return nextScheduledOccurrence(rule, start, after) === null;
}

// ---------------------------------------------------------------------------
// Presets en omschrijvingen
// ---------------------------------------------------------------------------

export const RECURRENCE_PRESETS = {
  daily: (): RecurrenceRule => ({
    freq: RecurrenceFreq.Daily,
    interval: 1,
    anchor: RecurrenceAnchor.Schedule,
  }),
  weekly: (): RecurrenceRule => ({
    freq: RecurrenceFreq.Weekly,
    interval: 1,
    anchor: RecurrenceAnchor.Schedule,
  }),
  monthly: (): RecurrenceRule => ({
    freq: RecurrenceFreq.Monthly,
    interval: 1,
    anchor: RecurrenceAnchor.Schedule,
  }),
  yearly: (): RecurrenceRule => ({
    freq: RecurrenceFreq.Yearly,
    interval: 1,
    anchor: RecurrenceAnchor.Schedule,
  }),
  weekdays: (): RecurrenceRule => ({
    freq: RecurrenceFreq.Weekly,
    interval: 1,
    byWeekday: [...WORKDAYS],
    anchor: RecurrenceAnchor.Schedule,
  }),
} as const;

const WEEKDAY_LABELS: Record<'nl' | 'en', Record<Weekday, string>> = {
  nl: { MO: 'maandag', TU: 'dinsdag', WE: 'woensdag', TH: 'donderdag', FR: 'vrijdag', SA: 'zaterdag', SU: 'zondag' },
  en: { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' },
};

const MONTH_LABELS: Record<'nl' | 'en', string[]> = {
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

function isWorkdaySet(days: readonly Weekday[] | undefined): boolean {
  if (!days || days.length !== 5) return false;
  return WORKDAYS.every((day) => days.includes(day));
}

/** Leesbare omschrijving, bijvoorbeeld "elke 2 weken op maandag en donderdag". */
export function describeRecurrence(rule: RecurrenceRule, locale: 'nl' | 'en' = 'nl'): string {
  const nl = locale === 'nl';
  const every = nl ? 'elke' : 'every';
  const interval = Math.max(1, Math.trunc(rule.interval));
  const plural = interval > 1;

  let base: string;
  switch (rule.freq) {
    case RecurrenceFreq.Daily:
      base = plural
        ? `${every} ${interval} ${nl ? 'dagen' : 'days'}`
        : nl
          ? 'elke dag'
          : 'every day';
      break;
    case RecurrenceFreq.Weekly: {
      if (isWorkdaySet(rule.byWeekday) && interval === 1) {
        return nl ? 'elke werkdag' : 'every weekday';
      }
      const period = plural
        ? `${every} ${interval} ${nl ? 'weken' : 'weeks'}`
        : nl
          ? 'elke week'
          : 'every week';
      if (rule.byWeekday?.length) {
        const names = sortedWeekdays(rule.byWeekday).map((day) => WEEKDAY_LABELS[locale][day]);
        const joined = joinList(names, locale);
        base = `${period} ${nl ? 'op' : 'on'} ${joined}`;
      } else {
        base = period;
      }
      break;
    }
    case RecurrenceFreq.Monthly: {
      const period = plural
        ? `${every} ${interval} ${nl ? 'maanden' : 'months'}`
        : nl
          ? 'elke maand'
          : 'every month';
      if (rule.byMonthDay?.length) {
        const days = rule.byMonthDay.map((day) =>
          day === -1 ? (nl ? 'de laatste dag' : 'the last day') : `${nl ? 'de' : 'the'} ${day}e`,
        );
        base = `${period} ${nl ? 'op' : 'on'} ${joinList(days, locale)}`;
      } else {
        base = period;
      }
      break;
    }
    case RecurrenceFreq.Yearly: {
      const period = plural
        ? `${every} ${interval} ${nl ? 'jaar' : 'years'}`
        : nl
          ? 'elk jaar'
          : 'every year';
      if (rule.byMonth?.length) {
        const months = rule.byMonth.map((month) => MONTH_LABELS[locale][month - 1] ?? '');
        base = `${period} ${nl ? 'in' : 'in'} ${joinList(months, locale)}`;
      } else {
        base = period;
      }
      break;
    }
  }

  if (rule.anchor === RecurrenceAnchor.Completion) {
    base += nl ? ' na afvinken' : ' after completion';
  }
  if (rule.count) {
    base += nl ? `, ${rule.count} keer` : `, ${rule.count} times`;
  } else if (rule.until) {
    base += nl ? `, tot ${rule.until}` : `, until ${rule.until}`;
  }
  return base;
}

function joinList(values: string[], locale: 'nl' | 'en'): string {
  if (values.length <= 1) return values[0] ?? '';
  const last = values[values.length - 1] as string;
  return `${values.slice(0, -1).join(', ')} ${locale === 'nl' ? 'en' : 'and'} ${last}`;
}
