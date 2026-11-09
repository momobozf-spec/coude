import { DateTime } from 'luxon';

import { getLexicon, type Lexicon } from './lexicon';
import type { ClockTime, DayPart, ISODate, Language, Recurrence, Weekday } from '../types/common';
import { alternation, bounded, normalizeText, removeSpans } from '../util/text';

/**
 * DateResolver – turns natural-language date/time phrases (nl / en / fr) into
 * concrete calendar values in the device timezone.
 *
 * Design rules (see ARCHITECTURE.md ADR-006):
 *  - all arithmetic is done with Luxon in an explicit IANA zone (DST safe);
 *  - the resolver never guesses silently: `hasExplicitTime` / `hasExplicitDate`
 *    tell the caller what was actually said so it can ask for clarification;
 *  - the LLM never produces absolute dates that bypass this module.
 */

export type TimePolicy = 'business' | 'morning' | 'literal';

export interface ResolveContext {
  /** "Now" in the device timezone. Tests inject fixed instants. */
  now: DateTime;
  timezone: string;
  language: Language;
  /**
   * How to interpret ambiguous hours without am/pm:
   *  - business (default): 1–6 → afternoon (13–18), 7–12 → as spoken
   *  - morning: alarms — hours are taken literally (6:30 = 06:30)
   *  - literal: never shift
   */
  timePolicy?: TimePolicy;
  /** When true (default), bare dates in the past roll to the next occurrence. Searches use false. */
  preferFuture?: boolean;
}

export interface DateResolution {
  date: ISODate | null;
  time: ClockTime | null;
  endDate: ISODate | null;
  endTime: ClockTime | null;
  /** Full ISO with offset when both date and time are known. */
  iso: string | null;
  endIso: string | null;
  durationMinutes: number | null;
  recurrence: Recurrence | null;
  dayPart: DayPart | null;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  /** True for "in 2 hours" style offsets (date and time derive from now). */
  isRelativeOffset: boolean;
  /** True when the phrase denotes a period rather than a moment (e.g. "yesterday", "last week"). */
  isRange: boolean;
  matchedText: string[];
  confidence: number;
}

export interface ExtractResult {
  resolution: DateResolution | null;
  /** The input with all date/time phrases removed. */
  remainingText: string;
  spans: Span[];
}

export interface Span {
  start: number;
  end: number;
  kind: string;
}

interface ClockSpec {
  hour: number;
  minute: number;
  meridiem: 'am' | 'pm' | null;
  /** hour ≥ 13 or 0, or explicitly 24h formatted → never shifted */
  explicit24: boolean;
}

interface Accumulator {
  dayOffset: number | null;
  weekday: { day: Weekday; modifier: 'plain' | 'this' | 'next' | 'last' } | null;
  explicit: { day: number; month: number; year: number | null } | null;
  offset: { minutes: number; hours: number; days: number; weeks: number; months: number } | null;
  time: ClockSpec | null;
  endTime: ClockSpec | null;
  dayPart: DayPart | null;
  durationMinutes: number | null;
  recurrence: Recurrence | null;
  nthWeekday: { position: number; weekday: Weekday; monthOffset: number } | null;
  endOfMonth: boolean;
  nextWeek: boolean;
  lastWeek: boolean;
  nextMonth: boolean;
  weekend: boolean;
  spans: Span[];
}

type Handler = (m: RegExpExecArray, acc: Accumulator, ctx: ResolveContext, lex: Lexicon) => boolean;

interface Pattern {
  kind: string;
  regex: RegExp;
  handle: Handler;
}

const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

function emptyAccumulator(): Accumulator {
  return {
    dayOffset: null,
    weekday: null,
    explicit: null,
    offset: null,
    time: null,
    endTime: null,
    dayPart: null,
    durationMinutes: null,
    recurrence: null,
    nthWeekday: null,
    endOfMonth: false,
    nextWeek: false,
    lastWeek: false,
    nextMonth: false,
    weekend: false,
    spans: [],
  };
}

function lookup<T>(table: readonly (readonly [string, T])[], key: string | undefined): T | undefined {
  if (key === undefined) return undefined;
  const k = key.trim();
  for (const [name, value] of table) if (name === k) return value;
  return undefined;
}

function keys<T>(table: readonly (readonly [string, T])[]): string[] {
  return table.map(([k]) => k);
}

function toWeekday(n: number | undefined): Weekday | null {
  if (n === undefined) return null;
  return WEEKDAY_ORDER.includes(n as Weekday) ? (n as Weekday) : null;
}

function parseNumber(lex: Lexicon, raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  const word = lookup(lex.numbers, t);
  return word ?? null;
}

/** "8", "8:30", "8.30", "8u30", "8h30", "8u", "8h", "14h", "20:00" */
function parseClock(raw: string, lex: Lexicon): ClockSpec | null {
  const m = /^(\d{1,2})(?:\s*[:.hu]\s*(\d{2})?)?\s*(?:(am|pm|a\.m\.|p\.m\.)?)$/i.exec(raw.trim());
  if (!m) {
    const word = parseNumber(lex, raw);
    if (word === null || word > 24) return null;
    return { hour: word, minute: 0, meridiem: null, explicit24: word === 0 || word >= 13 };
  }
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour > 24 || minute > 59) return null;
  const mer = m[3]?.toLowerCase().replace(/\./g, '');
  const meridiem = mer === 'am' ? 'am' : mer === 'pm' ? 'pm' : null;
  return { hour: hour === 24 ? 0 : hour, minute, meridiem, explicit24: hour === 0 || hour >= 13 || hour === 24 };
}

function meridiemFrom(lex: Lexicon, raw: string | undefined): 'am' | 'pm' | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (lex.meridiem.am.includes(t)) return 'am';
  if (lex.meridiem.pm.includes(t)) return 'pm';
  return null;
}

function dayPartFromPhrase(lex: Lexicon, raw: string | undefined): DayPart | null {
  if (!raw) return null;
  return lookup(lex.dayPartPhrases, raw.trim()) ?? null;
}

function setDayPart(acc: Accumulator, part: DayPart | null): void {
  if (part && !acc.dayPart) acc.dayPart = part;
}

function addSpan(acc: Accumulator, m: RegExpExecArray, kind: string): void {
  acc.spans.push({ start: m.index, end: m.index + m[0].length, kind });
}

// ---------------------------------------------------------------------------
// Pattern construction (per language, cached)
// ---------------------------------------------------------------------------

const patternCache = new Map<Language, Pattern[]>();

function buildPatterns(language: Language): Pattern[] {
  const cached = patternCache.get(language);
  if (cached) return cached;
  const lex = getLexicon(language);
  const w = lex.words;

  const NUM = `(\\d{1,3}(?:[.,]\\d+)?|${alternation(keys(lex.numbers))})`;
  const CLOCK = `(\\d{1,2}(?:\\s*[:.hu]\\s*\\d{2})?(?:\\s*(?:${alternation([...lex.meridiem.am, ...lex.meridiem.pm])}))?)`;
  const CLOCK_WORD = `(\\d{1,2}(?:\\s*[:.hu]\\s*\\d{2})?|${alternation(keys(lex.numbers))})`;
  const WEEKDAY = `(${alternation(keys(lex.weekdays))})`;
  const MONTH = `(${alternation(keys(lex.months))})`;
  const DAYPART = `(${alternation(keys(lex.dayPartPhrases))})`;
  const DAYPART_BARE = `(${alternation(keys(lex.dayPartPhrases).filter((k) => !k.includes(' ') && !k.startsWith("'")))})`;
  const MER = `(${alternation([...lex.meridiem.am, ...lex.meridiem.pm])})`;
  const HOURWORD = alternation(w.hourWord);
  const AT = alternation(w.at);
  const ON = alternation(w.on);
  const sp = '\\s+';
  const osp = '\\s*';
  const flags = 'giu';

  const patterns: Pattern[] = [];

  // 1. Relative offsets: "in 30 minutes", "over twee uur", "dans 2 heures", "in 3 days"
  patterns.push({
    kind: 'offset',
    regex: new RegExp(
      bounded(
        `${alternation(w.in)}${sp}${NUM}${osp}(?:${sp}and a half)?${sp}(${alternation([
          ...lex.units.minute,
          ...lex.units.hour,
          ...lex.units.day,
          ...lex.units.week,
          ...lex.units.month,
        ])})(?:${sp}(?:and a half|en een half|et demie?))?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const n = parseNumber(lx, m[1]);
      const unit = m[2] ?? '';
      if (n === null) return false;
      const half = /and a half|en een half|et demie?/.test(m[0]) ? 0.5 : 0;
      const value = n + half;
      const offset = { minutes: 0, hours: 0, days: 0, weeks: 0, months: 0 };
      if (lx.units.minute.includes(unit)) offset.minutes = value;
      else if (lx.units.hour.includes(unit)) offset.hours = value;
      else if (lx.units.day.includes(unit)) offset.days = value;
      else if (lx.units.week.includes(unit)) offset.weeks = value;
      else if (lx.units.month.includes(unit)) offset.months = value;
      else return false;
      acc.offset = offset;
      return true;
    },
  });

  // 2. Recurrence: "every Monday", "elke werkdag", "tous les lundis", "every day", "every week"
  patterns.push({
    kind: 'recurrence',
    regex: new RegExp(
      bounded(
        `${alternation(w.every)}${sp}(?:(${alternation(keys(lex.weekdays))})s?|(${alternation(w.weekdayNoun)})|(${alternation(w.dayNoun)})|(${alternation(w.weekNoun)})|(${alternation(w.monthNoun)})|(${alternation(w.weekend)}))`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const wd = toWeekday(lookup(lx.weekdays, m[1]));
      if (wd) {
        acc.recurrence = { frequency: 'WEEKLY', interval: 1, byWeekday: [wd] };
        acc.weekday = { day: wd, modifier: 'plain' };
      } else if (m[2]) {
        acc.recurrence = { frequency: 'WEEKLY', interval: 1, byWeekday: [1, 2, 3, 4, 5] };
      } else if (m[3]) {
        acc.recurrence = { frequency: 'DAILY', interval: 1 };
      } else if (m[4]) {
        acc.recurrence = { frequency: 'WEEKLY', interval: 1 };
      } else if (m[5]) {
        acc.recurrence = { frequency: 'MONTHLY', interval: 1 };
      } else if (m[6]) {
        acc.recurrence = { frequency: 'WEEKLY', interval: 1, byWeekday: [6] };
      } else return false;
      return true;
    },
  });
  if (language === 'fr') {
    // "en semaine" = on weekdays (recurring)
    patterns.push({
      kind: 'recurrence',
      regex: new RegExp(bounded('en semaine'), flags),
      handle: (_m, acc) => {
        acc.recurrence = { frequency: 'WEEKLY', interval: 1, byWeekday: [1, 2, 3, 4, 5] };
        return true;
      },
    });
  }

  // 3. "first Monday of next month" / "eerste maandag van volgende maand" / "premier lundi du mois prochain"
  patterns.push({
    kind: 'nthWeekday',
    regex: new RegExp(
      bounded(
        `(?:${ON}${sp})?(?:the${sp})?(${alternation(keys(w.ordinals))})${sp}${WEEKDAY}${sp}${alternation(w.of)}${sp}(?:(${alternation(w.next)})${sp})?(?:(${alternation(w.this)})${sp})?(?:the${sp})?(?:le${sp})?${alternation(w.monthNoun)}(?:${sp}(${alternation(w.nextSuffix.length ? w.nextSuffix : ['\\bnever\\b'])}))?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const position = lookup(lx.words.ordinals, m[1]);
      const wd = toWeekday(lookup(lx.weekdays, m[2]));
      if (position === undefined || !wd) return false;
      const isNext = Boolean(m[3]) || Boolean(m[5]);
      acc.nthWeekday = { position, weekday: wd, monthOffset: isNext ? 1 : 0 };
      return true;
    },
  });

  // 4. "end of the month" / "einde van de maand" / "fin du mois"
  patterns.push({
    kind: 'endOfMonth',
    regex: new RegExp(bounded(`${alternation(w.endOf)}${sp}(?:de${sp}|le${sp}|the${sp})?${alternation(w.monthNoun)}`), flags),
    handle: (_m, acc) => {
      acc.endOfMonth = true;
      return true;
    },
  });

  // 5. "next week" / "volgende week" / "la semaine prochaine", "next month", "last week"
  patterns.push({
    kind: 'nextWeek',
    regex: new RegExp(
      bounded(
        `(?:(${alternation(w.next)})${sp}(${alternation([...w.weekNoun, ...w.monthNoun])})|(?:la${sp}|le${sp})?(${alternation([...w.weekNoun, ...w.monthNoun])})${sp}(${alternation(w.nextSuffix.length ? w.nextSuffix : ['\\bnever\\b'])})|(${alternation(w.last)})${sp}(${alternation(w.weekNoun)})|(?:la${sp})?(${alternation(w.weekNoun)})${sp}(${alternation(w.last)}))`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const nextNoun = m[2] ?? m[3];
      if (nextNoun) {
        if (lx.words.weekNoun.includes(nextNoun)) acc.nextWeek = true;
        else acc.nextMonth = true;
        return true;
      }
      if (m[6] || m[7]) {
        acc.lastWeek = true;
        return true;
      }
      return false;
    },
  });

  // 6. Compound day parts: "tonight", "morgenochtend", "demain matin", "tomorrow morning"
  patterns.push({
    kind: 'compoundDayPart',
    regex: new RegExp(bounded(`(${alternation(keys(lex.compoundDayParts))})`), flags),
    handle: (m, acc, _ctx, lx) => {
      const v = lookup(lx.compoundDayParts, m[1]);
      if (!v) return false;
      acc.dayOffset = v.offset;
      setDayPart(acc, v.part);
      return true;
    },
  });

  // 7. Relative days: "today", "tomorrow", "overmorgen", "après-demain"
  patterns.push({
    kind: 'relativeDay',
    regex: new RegExp(bounded(`(${alternation(keys(lex.relativeDays))})`), flags),
    handle: (m, acc, _ctx, lx) => {
      const v = lookup(lx.relativeDays, m[1]);
      if (v === undefined) return false;
      acc.dayOffset = v;
      return true;
    },
  });

  // 8. Weekday with optional modifier: "next Monday", "this Friday", "on Thursday", "volgende maandag",
  //    "aanstaande vrijdag", "lundi prochain", "ce vendredi", "vendredi"
  patterns.push({
    kind: 'weekday',
    regex: new RegExp(
      bounded(
        `(?:${ON}${sp})?(?:(${alternation(w.next)})${sp}|(${alternation(w.this)})${sp}|(${alternation(w.last)})${sp})?${WEEKDAY}(?:${sp}(${alternation(w.nextSuffix.length ? w.nextSuffix : ['\\bnever\\b'])})|${sp}(${alternation(w.last)}))?(?:${osp}${DAYPART_BARE})?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const wd = toWeekday(lookup(lx.weekdays, m[4]));
      if (!wd) return false;
      // Two-letter Dutch abbreviations ("do", "wo") are too ambiguous in prose; require ≥3 letters.
      if ((m[4] ?? '').length < 3 && !m[1] && !m[2]) return false;
      let modifier: 'plain' | 'this' | 'next' | 'last' = 'plain';
      if (m[1]) modifier = 'next';
      else if (m[2] || m[5]) modifier = 'this';
      else if (m[3] || m[6]) modifier = 'last';
      acc.weekday = { day: wd, modifier };
      setDayPart(acc, dayPartFromPhrase(lx, m[7]));
      return true;
    },
  });

  // 9. Explicit dates: "25 September (2026)", "September 25(th)", "25/09(/2026)", "le 25 septembre", "1er mai"
  patterns.push({
    kind: 'explicitDate',
    regex: new RegExp(
      bounded(
        `(?:${ON}${sp})?(?:the${sp})?(?:(\\d{1,2})(?:st|nd|rd|th|e|ste|de|er)?${sp}(?:of${sp})?${MONTH}|${MONTH}${sp}(\\d{1,2})(?:st|nd|rd|th)?)(?:,?${sp}(\\d{4}))?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const day = Number(m[1] ?? m[4]);
      const month = lookup(lx.months, m[2] ?? m[3]);
      if (!month || !day || day > 31) return false;
      acc.explicit = { day, month, year: m[5] ? Number(m[5]) : null };
      return true;
    },
  });
  patterns.push({
    kind: 'numericDate',
    regex: new RegExp(bounded(`(?:${ON}${sp})?(\\d{1,2})[/\\-](\\d{1,2})(?:[/\\-](\\d{2,4}))?`), flags),
    handle: (m, acc) => {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day < 1 || day > 31 || month < 1 || month > 12) return false;
      let year: number | null = m[3] ? Number(m[3]) : null;
      if (year !== null && year < 100) year += 2000;
      acc.explicit = { day, month, year };
      return true;
    },
  });

  // 10. Time ranges: "from 7 until 8 (in the evening)", "van 7 tot 8", "de 7h à 8h", "between 2 and 3", "19:00-20:00"
  patterns.push({
    kind: 'timeRange',
    regex: new RegExp(
      bounded(
        `(?:${alternation([...w.from, ...w.between])}${sp})?${CLOCK}(?:${osp}${HOURWORD})?${osp}(?:${alternation([...w.to, ...w.and])}|[-–])${osp}${CLOCK}(?:${osp}${HOURWORD})?(?:${sp}${DAYPART})?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const start = parseClock(m[1] ?? '', lx);
      const end = parseClock(m[2] ?? '', lx);
      if (!start || !end) return false;
      // Guard against "25/09 - 26/09" style or plain number lists: require preposition, colon or hour word.
      const hasCue = /[:.]|\d\s*[hu]\b/.test(m[0]) || new RegExp(`^(?:${alternation([...lx.words.from, ...lx.words.between])})`, 'iu').test(m[0]) || /[hu]\s*(?:\d{2})?/.test(m[0]);
      if (!hasCue && !m[3]) return false;
      acc.time = start;
      acc.endTime = end;
      setDayPart(acc, dayPartFromPhrase(lx, m[3]));
      return true;
    },
  });

  // 11a. Quarter/half idioms.
  if (language === 'en') {
    patterns.push({
      kind: 'timeIdiom',
      regex: new RegExp(
        bounded(`(?:${AT}${sp})?(half|(?:a${sp})?quarter)${sp}(past|after|to|before)${sp}${CLOCK_WORD}(?:${sp}${MER})?(?:${sp}${DAYPART})?`),
        flags,
      ),
      handle: (m, acc, _ctx, lx) => {
        const base = parseClock(m[3] ?? '', lx);
        if (!base) return false;
        const isHalf = (m[1] ?? '').includes('half');
        const before = m[2] === 'to' || m[2] === 'before';
        let hour = base.hour;
        let minute = isHalf ? 30 : 15;
        if (before) {
          hour = (hour + 23) % 24;
          minute = 45;
        }
        acc.time = { hour, minute, meridiem: meridiemFrom(lx, m[4]), explicit24: false };
        setDayPart(acc, dayPartFromPhrase(lx, m[5]));
        return true;
      },
    });
    patterns.push({
      kind: 'noon',
      regex: new RegExp(bounded(`(?:${AT}${sp})?(${alternation([...w.noon, ...w.midnight])})`), flags),
      handle: (m, acc, _ctx, lx) => {
        const isNoon = lx.words.noon.includes(m[1] ?? '');
        acc.time = { hour: isNoon ? 12 : 0, minute: 0, meridiem: null, explicit24: true };
        return true;
      },
    });
  }
  if (language === 'nl') {
    // "half zeven" = 06:30 (!), "kwart over zes" = 06:15, "kwart voor acht" = 07:45, "half 7" = 06:30
    patterns.push({
      kind: 'timeIdiom',
      regex: new RegExp(
        bounded(`(?:${AT}${sp})?(?:(half)${sp}${CLOCK_WORD}|(kwart)${sp}(over|voor|na)${sp}${CLOCK_WORD})(?:${sp}${DAYPART})?`),
        flags,
      ),
      handle: (m, acc, _ctx, lx) => {
        if (m[1]) {
          const base = parseClock(m[2] ?? '', lx);
          if (!base) return false;
          acc.time = { hour: (base.hour + 23) % 24, minute: 30, meridiem: null, explicit24: false };
        } else {
          const base = parseClock(m[5] ?? '', lx);
          if (!base) return false;
          const before = m[4] === 'voor';
          acc.time = before
            ? { hour: (base.hour + 23) % 24, minute: 45, meridiem: null, explicit24: false }
            : { hour: base.hour, minute: 15, meridiem: null, explicit24: false };
        }
        setDayPart(acc, dayPartFromPhrase(lx, m[6]));
        return true;
      },
    });
    patterns.push({
      kind: 'noon',
      regex: new RegExp(bounded(`(?:${AT}${sp})?(middernacht|twaalf uur 's middags|twaalf uur)`), flags),
      handle: (m, acc) => {
        acc.time = { hour: (m[1] ?? '') === 'middernacht' ? 0 : 12, minute: 0, meridiem: null, explicit24: true };
        return true;
      },
    });
  }
  if (language === 'fr') {
    // "huit heures et quart" = 08:15, "et demie" = 08:30, "moins le quart" = 07:45, "midi et demi"
    patterns.push({
      kind: 'timeIdiom',
      regex: new RegExp(
        bounded(
          `(?:${AT}${sp})?(?:${CLOCK_WORD}${osp}(?:${HOURWORD})?|(midi|minuit))${sp}(?:(et${sp}quart)|(et${sp}demie?)|(moins${sp}(?:le${sp})?quart))(?:${sp}${DAYPART})?`,
        ),
        flags,
      ),
      handle: (m, acc, _ctx, lx) => {
        let hour: number;
        let explicit24 = false;
        if (m[2]) {
          hour = m[2] === 'midi' ? 12 : 0;
          explicit24 = true;
        } else {
          const base = parseClock(m[1] ?? '', lx);
          if (!base) return false;
          hour = base.hour;
          explicit24 = base.explicit24;
        }
        let minute = 0;
        if (m[3]) minute = 15;
        else if (m[4]) minute = 30;
        else if (m[5]) {
          hour = (hour + 23) % 24;
          minute = 45;
        }
        acc.time = { hour, minute, meridiem: null, explicit24 };
        setDayPart(acc, dayPartFromPhrase(lx, m[6]));
        return true;
      },
    });
    patterns.push({
      kind: 'noon',
      regex: new RegExp(bounded(`(?:${AT}${sp})?(midi|minuit)`), flags),
      handle: (m, acc) => {
        acc.time = { hour: m[1] === 'midi' ? 12 : 0, minute: 0, meridiem: null, explicit24: true };
        return true;
      },
    });
  }

  // 12. Durations: "for one hour", "for 30 minutes", "van een uur", "gedurende een uur", "pendant une heure", "d'une heure"
  patterns.push({
    kind: 'duration',
    regex: new RegExp(
      bounded(
        `${alternation(w.for)}${osp}${NUM}(?:${sp}and a half|${sp}en een half|${sp}et demie?)?${sp}(${alternation([...lex.units.minute, ...lex.units.hour])})(?:${sp}(?:and a half|en een half|et demie?|lang))?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const n = parseNumber(lx, m[1]);
      if (n === null) return false;
      const half = /and a half|en een half|et demie?/.test(m[0]) ? 0.5 : 0;
      const unit = m[2] ?? '';
      const minutes = lx.units.hour.includes(unit) ? (n + half) * 60 : n + half;
      acc.durationMinutes = Math.round(minutes);
      return true;
    },
  });
  if (language === 'nl') {
    patterns.push({
      kind: 'duration',
      regex: new RegExp(bounded(`${NUM}${sp}(${alternation([...lex.units.minute, ...lex.units.hour])})${sp}lang`), flags),
      handle: (m, acc, _ctx, lx) => {
        const n = parseNumber(lx, m[1]);
        if (n === null) return false;
        const unit = m[2] ?? '';
        acc.durationMinutes = Math.round(lx.units.hour.includes(unit) ? n * 60 : n);
        return true;
      },
    });
  }

  // 11b. Plain clock times: "at 8", "at 8:30", "om 8 uur", "om 14u30", "à 8 heures", "à 14h", "8 pm", "around 4 PM"
  patterns.push({
    kind: 'time',
    regex: new RegExp(
      bounded(
        `(?:${AT}${sp})?${CLOCK_WORD}(?:${osp}${HOURWORD}(?:${osp}(\\d{2}))?)?(?:${osp}${MER})?(?:${sp}${DAYPART})?`,
      ),
      flags,
    ),
    handle: (m, acc, _ctx, lx) => {
      const raw = m[1] ?? '';
      const hasAt = new RegExp(`^${alternation(lx.words.at)}\\s`, 'iu').test(m[0]);
      const hasHourWord = m[2] !== undefined || new RegExp(`${alternation(lx.words.hourWord)}\\s*$|${alternation(lx.words.hourWord)}\\s`, 'iu').test(m[0].slice(raw.length));
      const hasColon = /[:.]\d{2}|\d[hu]\d{2}|\d\s*[hu]\b/.test(m[0]);
      const mer = meridiemFrom(lx, m[3]);
      const part = dayPartFromPhrase(lx, m[4]);
      // A bare number is only a time when it has a cue: preposition, "uur"/"heures"/"o'clock", am/pm, or hh:mm.
      if (!hasAt && !hasHourWord && !hasColon && !mer && !part) return false;
      const spec = parseClock(raw, lx);
      if (!spec) return false;
      if (m[2]) spec.minute = Number(m[2]);
      if (mer) spec.meridiem = mer;
      if (spec.hour > 24) return false;
      if (acc.time) return false; // an earlier phrase already gave the time
      acc.time = spec;
      setDayPart(acc, part);
      return true;
    },
  });

  // 13. Standalone day parts: "in the morning", "'s avonds", "le soir"
  patterns.push({
    kind: 'dayPart',
    regex: new RegExp(bounded(`(${alternation(keys(lex.dayPartPhrases).filter((k) => k.includes(' ') || k.startsWith("'")))})`), flags),
    handle: (m, acc, _ctx, lx) => {
      const part = dayPartFromPhrase(lx, m[1]);
      if (!part) return false;
      setDayPart(acc, part);
      return true;
    },
  });

  // 14. Weekend
  patterns.push({
    kind: 'weekend',
    regex: new RegExp(bounded(`(${alternation(w.weekend)})`), flags),
    handle: (_m, acc) => {
      acc.weekend = true;
      return true;
    },
  });

  patternCache.set(language, patterns);
  return patterns;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function applyTimePolicy(spec: ClockSpec, dayPart: DayPart | null, policy: TimePolicy): { hour: number; minute: number } {
  let { hour } = spec;
  const { minute } = spec;
  if (spec.meridiem === 'am') {
    if (hour === 12) hour = 0;
    return { hour, minute };
  }
  if (spec.meridiem === 'pm') {
    if (hour < 12) hour += 12;
    return { hour, minute };
  }
  if (spec.explicit24) return { hour, minute };
  if (dayPart) {
    if (dayPart === 'morning') return { hour: hour === 12 ? 0 : hour, minute };
    if (dayPart === 'noon') return { hour, minute };
    if (dayPart === 'afternoon' || dayPart === 'evening') return { hour: hour < 12 ? hour + 12 : hour, minute };
    // night: 6..11 → evening hours, 12 → midnight, 1..5 → early morning
    if (hour === 12) return { hour: 0, minute };
    return { hour: hour >= 6 && hour < 12 ? hour + 12 : hour, minute };
  }
  if (policy === 'business' && hour >= 1 && hour <= 6) return { hour: hour + 12, minute };
  return { hour, minute };
}

function nthWeekdayOfMonth(monthStart: DateTime, weekday: Weekday, position: number): DateTime {
  if (position === -1) {
    const monthEnd = monthStart.endOf('month').startOf('day');
    const back = (monthEnd.weekday - weekday + 7) % 7;
    return monthEnd.minus({ days: back });
  }
  const forward = (weekday - monthStart.weekday + 7) % 7;
  return monthStart.plus({ days: forward + (position - 1) * 7 });
}

function resolveWeekday(base: DateTime, weekday: Weekday, modifier: 'plain' | 'this' | 'next' | 'last', timeStillAhead: boolean): DateTime {
  const today = base.startOf('day');
  if (modifier === 'next') {
    const startOfNextWeek = today.startOf('week').plus({ weeks: 1 });
    return startOfNextWeek.plus({ days: weekday - 1 });
  }
  if (modifier === 'last') {
    const delta = (today.weekday - weekday + 7) % 7 || 7;
    return today.minus({ days: delta });
  }
  let delta = (weekday - today.weekday + 7) % 7;
  if (delta === 0 && !timeStillAhead) delta = 7;
  return today.plus({ days: delta });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function assemble(acc: Accumulator, ctx: ResolveContext, lex: Lexicon): DateResolution | null {
  const anything =
    acc.dayOffset !== null || acc.weekday || acc.explicit || acc.offset || acc.time || acc.dayPart || acc.durationMinutes !== null ||
    acc.recurrence || acc.nthWeekday || acc.endOfMonth || acc.nextWeek || acc.lastWeek || acc.nextMonth || acc.weekend;
  if (!anything) return null;

  const policy = ctx.timePolicy ?? 'business';
  const preferFuture = ctx.preferFuture ?? true;
  const now = ctx.now.setZone(ctx.timezone);
  const today = now.startOf('day');

  let date: DateTime | null = null;
  let endDate: DateTime | null = null;
  let time: { hour: number; minute: number } | null = null;
  let endTime: { hour: number; minute: number } | null = null;
  let hasExplicitDate = false;
  let hasExplicitTime = false;
  let isRelativeOffset = false;
  let isRange = false;
  let confidence = 0.95;

  if (acc.time) {
    time = applyTimePolicy(acc.time, acc.dayPart, policy);
    hasExplicitTime = true;
  }
  if (acc.endTime) {
    endTime = applyTimePolicy(acc.endTime, acc.dayPart, policy);
    if (time && endTime.hour * 60 + endTime.minute <= time.hour * 60 + time.minute) {
      // "from 11 to 1" → 11:00–13:00 ; "from 7 to 8" already fine
      if (!acc.endTime.explicit24 && endTime.hour < 12) endTime = { hour: endTime.hour + 12, minute: endTime.minute };
    }
    if (time && !acc.time?.explicit24 && !acc.time?.meridiem && !acc.dayPart && endTime.hour >= 12 && time.hour < 12 && endTime.hour - time.hour > 6) {
      // "from 7 until 8 in the evening" handled by dayPart; "from 7 to 20" → start likely 19:00
      time = { hour: time.hour + 12, minute: time.minute };
    }
  }

  if (acc.offset) {
    const target = now.plus({
      minutes: acc.offset.minutes,
      hours: acc.offset.hours,
      days: acc.offset.days,
      weeks: acc.offset.weeks,
      months: acc.offset.months,
    });
    date = target.startOf('day');
    if (acc.offset.minutes || acc.offset.hours) {
      time = { hour: target.hour, minute: target.minute };
      hasExplicitTime = true;
      isRelativeOffset = true;
    }
    hasExplicitDate = true;
  } else if (acc.nthWeekday) {
    const monthStart = today.startOf('month').plus({ months: acc.nthWeekday.monthOffset });
    date = nthWeekdayOfMonth(monthStart, acc.nthWeekday.weekday, acc.nthWeekday.position);
    if (date < today && acc.nthWeekday.monthOffset === 0 && preferFuture) {
      date = nthWeekdayOfMonth(monthStart.plus({ months: 1 }), acc.nthWeekday.weekday, acc.nthWeekday.position);
    }
    hasExplicitDate = true;
  } else if (acc.endOfMonth) {
    date = today.endOf('month').startOf('day');
    hasExplicitDate = true;
  } else if (acc.explicit) {
    const year = acc.explicit.year ?? today.year;
    let candidate = DateTime.fromObject({ year, month: acc.explicit.month, day: acc.explicit.day }, { zone: ctx.timezone });
    if (!candidate.isValid) return null;
    if (acc.explicit.year === null && preferFuture && candidate < today) candidate = candidate.plus({ years: 1 });
    date = candidate;
    hasExplicitDate = true;
  } else if (acc.dayOffset !== null) {
    date = today.plus({ days: acc.dayOffset });
    hasExplicitDate = true;
    if (acc.dayOffset < 0) isRange = true;
  } else if (acc.weekday) {
    const timeAhead = time ? time.hour * 60 + time.minute > now.hour * 60 + now.minute : true;
    date = resolveWeekday(today, acc.weekday.day, acc.weekday.modifier, timeAhead);
    hasExplicitDate = true;
    if (acc.weekday.modifier === 'last') isRange = true;
  } else if (acc.nextWeek) {
    date = today.startOf('week').plus({ weeks: 1 });
    endDate = date.plus({ days: 6 });
    hasExplicitDate = true;
    isRange = true;
    confidence = 0.85;
  } else if (acc.lastWeek) {
    date = today.startOf('week').minus({ weeks: 1 });
    endDate = date.plus({ days: 6 });
    hasExplicitDate = true;
    isRange = true;
  } else if (acc.nextMonth) {
    date = today.startOf('month').plus({ months: 1 });
    endDate = date.endOf('month').startOf('day');
    hasExplicitDate = true;
    isRange = true;
    confidence = 0.85;
  } else if (acc.weekend) {
    const delta = (6 - today.weekday + 7) % 7;
    date = today.plus({ days: delta });
    hasExplicitDate = true;
  }

  if (acc.recurrence && !date) {
    date = today;
    hasExplicitDate = true;
  }

  // Time only: "at 8" → today if still ahead, else tomorrow.
  if (!date && (time || acc.dayPart)) {
    const t = time ?? parseDefault(lex.dayPartDefaults[acc.dayPart ?? 'morning']);
    const candidate = today.set({ hour: t.hour, minute: t.minute });
    date = preferFuture && candidate <= now ? today.plus({ days: 1 }) : today;
    confidence = 0.8;
  }

  // Day part without explicit time → default time, flagged as not explicit.
  if (date && !time && acc.dayPart && !isRange) {
    time = parseDefault(lex.dayPartDefaults[acc.dayPart]);
    hasExplicitTime = false;
  }

  if (!date && !time && acc.durationMinutes === null && !acc.recurrence) return null;

  const dateStr = date ? date.toISODate() : null;
  const timeStr = time ? `${pad(time.hour)}:${pad(time.minute)}` : null;
  const endTimeStr = endTime ? `${pad(endTime.hour)}:${pad(endTime.minute)}` : null;
  let endDateStr = endDate ? endDate.toISODate() : null;

  let iso: string | null = null;
  let endIso: string | null = null;
  if (date && time) {
    const dt = date.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 });
    iso = dt.toISO({ suppressMilliseconds: true });
    if (endTime) {
      let end = date.set({ hour: endTime.hour, minute: endTime.minute, second: 0, millisecond: 0 });
      if (end <= dt) end = end.plus({ days: 1 });
      endIso = end.toISO({ suppressMilliseconds: true });
      if (end.toISODate() !== date.toISODate()) endDateStr = end.toISODate();
    } else if (acc.durationMinutes !== null) {
      const end = dt.plus({ minutes: acc.durationMinutes });
      endIso = end.toISO({ suppressMilliseconds: true });
    }
  }

  const durationMinutes =
    acc.durationMinutes ??
    (time && endTime ? ((endTime.hour * 60 + endTime.minute - (time.hour * 60 + time.minute)) + 1440) % 1440 || null : null);

  return {
    date: dateStr,
    time: timeStr,
    endDate: endDateStr,
    endTime: endTimeStr,
    iso,
    endIso,
    durationMinutes,
    recurrence: acc.recurrence,
    dayPart: acc.dayPart,
    hasExplicitDate,
    hasExplicitTime,
    isRelativeOffset,
    isRange,
    matchedText: [],
    confidence,
  };
}

function parseDefault(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':');
  return { hour: Number(h ?? 0), minute: Number(m ?? 0) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class DateResolver {
  /**
   * Finds and resolves every date/time phrase in `text`.
   * Returns the resolution plus the text with the phrases removed.
   */
  extract(text: string, ctx: ResolveContext): ExtractResult {
    const normalized = normalizeText(text);
    const lex = getLexicon(ctx.language);
    const patterns = buildPatterns(ctx.language);
    const consumed: boolean[] = new Array<boolean>(normalized.length).fill(false);
    const acc = emptyAccumulator();

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.regex.exec(normalized)) !== null) {
        if (m[0].length === 0) {
          pattern.regex.lastIndex++;
          continue;
        }
        const start = m.index;
        const end = start + m[0].length;
        let overlaps = false;
        for (let i = start; i < end; i++) {
          if (consumed[i]) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        const before = acc.spans.length;
        const accepted = pattern.handle(m, acc, ctx, lex);
        if (!accepted) continue;
        if (acc.spans.length === before) addSpan(acc, m, pattern.kind);
        for (let i = start; i < end; i++) consumed[i] = true;
      }
    }

    const resolution = assemble(acc, ctx, lex);
    const spans = [...acc.spans].sort((a, b) => a.start - b.start);
    const remainingText = removeSpans(normalized, spans);
    if (resolution) resolution.matchedText = spans.map((s) => normalized.slice(s.start, s.end));
    return { resolution, remainingText, spans };
  }

  /** Resolves a phrase that is (mostly) a date/time expression, e.g. an answer to "When?". */
  resolve(text: string, ctx: ResolveContext): DateResolution | null {
    return this.extract(text, ctx).resolution;
  }

  /** Convenience: current time in the given zone. */
  static now(timezone: string): DateTime {
    return DateTime.now().setZone(timezone);
  }
}

export const dateResolver = new DateResolver();

/** Builds a ResolveContext from primitives (used by the engine and tests). */
export function makeResolveContext(params: {
  nowISO?: string;
  timezone: string;
  language: Language;
  timePolicy?: TimePolicy;
  preferFuture?: boolean;
}): ResolveContext {
  const now = params.nowISO
    ? DateTime.fromISO(params.nowISO, { zone: params.timezone })
    : DateTime.now().setZone(params.timezone);
  return {
    now,
    timezone: params.timezone,
    language: params.language,
    timePolicy: params.timePolicy,
    preferFuture: params.preferFuture,
  };
}

/** Combines a date and time string in a zone into a full ISO string. */
export function combineDateTime(date: ISODate, time: ClockTime, timezone: string): string | null {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true }) : null;
}

export function isPast(date: ISODate, time: ClockTime | null, now: DateTime, timezone: string): boolean {
  const dt = DateTime.fromISO(time ? `${date}T${time}` : `${date}T23:59`, { zone: timezone });
  return dt.isValid && dt < now;
}
