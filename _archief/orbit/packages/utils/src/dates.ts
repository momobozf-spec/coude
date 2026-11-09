import type { IsoDate, IsoDateTime, IsoTime } from '@orbit/types';

/**
 * Datumlogica zonder externe library.
 *
 * Twee soorten tijd, bewust gescheiden:
 * - `IsoDate` (`2026-08-25`) is een kalenderdag zonder tijdzone. "Deze taak is
 *   voor dinsdag" betekent dinsdag in de tijdzone van de gebruiker, waar hij ook is.
 * - `IsoDateTime` is een absoluut moment in UTC. Reminders zijn altijd absoluut.
 *
 * De conversie tussen beide gebeurt op precies één plek: `zonedDateTimeToUtc`.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

export function parseIsoDate(value: IsoDate): DateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new TypeError(`Ongeldige datum: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function parseIsoTime(value: IsoTime): TimeParts {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new TypeError(`Ongeldige tijd: ${value}`);
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  };
}

export function isValidIsoDate(value: string): value is IsoDate {
  if (!DATE_PATTERN.test(value)) return false;
  const { year, month, day } = parseIsoDate(value);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isValidIsoTime(value: string): value is IsoTime {
  if (!TIME_PATTERN.test(value)) return false;
  const { hour, minute, second } = parseIsoTime(value);
  return hour < 24 && minute < 60 && second < 60;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function formatIsoDate(parts: DateParts): IsoDate {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatIsoTime(parts: TimeParts): IsoTime {
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Datumrekenen gebeurt op UTC-middag. Middag in plaats van middernacht, zodat
 * een zomertijdsprong van een uur nooit een dag over de grens duwt.
 */
function toUtcNoon(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return Date.UTC(year, month - 1, day, 12);
}

function fromUtcNoon(ms: number): IsoDate {
  const d = new Date(ms);
  return formatIsoDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcNoon(toUtcNoon(date) + days * DAY_MS);
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  // 31 januari + 1 maand wordt 28/29 februari, niet 3 maart.
  const clampedDay = Math.min(day, daysInMonth(newYear, newMonth));
  return formatIsoDate({ year: newYear, month: newMonth, day: clampedDay });
}

export function addYears(date: IsoDate, years: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const newYear = year + years;
  return formatIsoDate({ year: newYear, month, day: Math.min(day, daysInMonth(newYear, month)) });
}

/** Aantal hele dagen van `from` naar `to`; negatief als `to` in het verleden ligt. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = zondag ... 6 = zaterdag. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtcNoon(date)).getUTCDay();
}

export function startOfWeek(date: IsoDate, weekStartsOn: 0 | 1 = 1): IsoDate {
  const current = dayOfWeek(date);
  const diff = (current - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function endOfWeek(date: IsoDate, weekStartsOn: 0 | 1 = 1): IsoDate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date);
  return formatIsoDate({ year, month, day: 1 });
}

export function endOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date);
  return formatIsoDate({ year, month, day: daysInMonth(year, month) });
}

/** Alle dagen in `[from, to]`, inclusief beide grenzen. */
export function eachDayInRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  let cursor = from;
  while (compareIsoDates(cursor, to) <= 0) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (days.length > 3660) throw new RangeError('Datumbereik is te groot');
  }
  return days;
}

// ---------------------------------------------------------------------------
// Tijdzones
// ---------------------------------------------------------------------------

/** Offset van de zone ten opzichte van UTC, in milliseconden, op dat moment. */
export function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    lookup.year ?? 1970,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    (lookup.hour ?? 0) % 24,
    lookup.minute ?? 0,
    lookup.second ?? 0,
  );
  return asUtc - utcMs;
}

/** De kalenderdag die het in `timeZone` is op moment `now`. */
export function todayInTimeZone(now: Date, timeZone: string): IsoDate {
  const shifted = new Date(now.getTime() + timeZoneOffsetMs(now.getTime(), timeZone));
  return formatIsoDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function currentTimeInTimeZone(now: Date, timeZone: string): IsoTime {
  const shifted = new Date(now.getTime() + timeZoneOffsetMs(now.getTime(), timeZone));
  return formatIsoTime({
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: 0,
  });
}

/**
 * "25 augustus om 14:00 in Europe/Brussels" naar een absoluut UTC-moment.
 * De tweede offsetmeting vangt zomertijdovergangen af.
 */
export function zonedDateTimeToUtc(
  date: IsoDate,
  time: IsoTime,
  timeZone: string,
): IsoDateTime {
  const { year, month, day } = parseIsoDate(date);
  const { hour, minute, second } = parseIsoTime(time);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = naive - timeZoneOffsetMs(naive, timeZone);
  const correctedOffset = timeZoneOffsetMs(firstGuess, timeZone);
  return new Date(naive - correctedOffset).toISOString();
}

export function utcToZonedDate(instant: IsoDateTime, timeZone: string): IsoDate {
  return todayInTimeZone(new Date(instant), timeZone);
}

export function utcToZonedTime(instant: IsoDateTime, timeZone: string): IsoTime {
  return currentTimeInTimeZone(new Date(instant), timeZone);
}

export function nowIso(now: Date = new Date()): IsoDateTime {
  return now.toISOString();
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Relatieve weergave
// ---------------------------------------------------------------------------

export interface RelativeDateLabel {
  /** Sleutel voor de vertaling; de UI bepaalt de tekst. */
  key: 'overdue' | 'today' | 'tomorrow' | 'yesterday' | 'thisWeek' | 'nextWeek' | 'date';
  daysFromToday: number;
}

export function describeRelativeDate(date: IsoDate, today: IsoDate): RelativeDateLabel {
  const diff = differenceInDays(today, date);
  if (diff === 0) return { key: 'today', daysFromToday: 0 };
  if (diff === 1) return { key: 'tomorrow', daysFromToday: 1 };
  if (diff === -1) return { key: 'yesterday', daysFromToday: -1 };
  if (diff < 0) return { key: 'overdue', daysFromToday: diff };
  if (diff <= 6) return { key: 'thisWeek', daysFromToday: diff };
  if (diff <= 13) return { key: 'nextWeek', daysFromToday: diff };
  return { key: 'date', daysFromToday: diff };
}
