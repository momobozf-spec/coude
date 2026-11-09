import type { IsoDate } from './ids';

export const RecurrenceFreq = {
  Daily: 'DAILY',
  Weekly: 'WEEKLY',
  Monthly: 'MONTHLY',
  Yearly: 'YEARLY',
} as const;
export type RecurrenceFreq = (typeof RecurrenceFreq)[keyof typeof RecurrenceFreq];

export const Weekday = {
  Mon: 'MO',
  Tue: 'TU',
  Wed: 'WE',
  Thu: 'TH',
  Fri: 'FR',
  Sat: 'SA',
  Sun: 'SU',
} as const;
export type Weekday = (typeof Weekday)[keyof typeof Weekday];

export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const WORKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

/**
 * Een bewuste subset van RFC 5545. Genoeg voor dagelijks, wekelijks, maandelijks,
 * jaarlijks, elke werkdag en de gangbare custom-varianten, zonder de complexiteit
 * van een volledige RRULE-implementatie.
 *
 * `elke werkdag`  -> { freq: WEEKLY, interval: 1, byWeekday: WORKDAYS }
 * `elke 2 weken op ma en do` -> { freq: WEEKLY, interval: 2, byWeekday: ['MO','TH'] }
 * `3 dagen na afvinken` -> { freq: DAILY, interval: 3, anchor: 'COMPLETION' }
 */
export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Elke N periodes. Minimaal 1. */
  interval: number;
  /** Alleen bij WEEKLY. Leeg betekent: dezelfde weekdag als de startdatum. */
  byWeekday?: Weekday[];
  /** Alleen bij MONTHLY. Negatieve waarden tellen vanaf het einde (-1 = laatste dag). */
  byMonthDay?: number[];
  /** Alleen bij YEARLY. 1-12. */
  byMonth?: number[];
  /** Stopt op deze datum (inclusief). */
  until?: IsoDate;
  /** Stopt na dit aantal voorkomens. */
  count?: number;
  /**
   * SCHEDULE: de volgende datum wordt berekend vanaf de geplande datum (klassiek).
   * COMPLETION: vanaf het moment van afvinken ("elke 3 dagen na afvinken").
   */
  anchor: RecurrenceAnchor;
}

export const RecurrenceAnchor = {
  Schedule: 'SCHEDULE',
  Completion: 'COMPLETION',
} as const;
export type RecurrenceAnchor = (typeof RecurrenceAnchor)[keyof typeof RecurrenceAnchor];
