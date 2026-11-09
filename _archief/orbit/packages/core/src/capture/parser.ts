import {
  CaptureSource,
  ItemType,
  Priority,
  RecurrenceAnchor,
  RecurrenceFreq,
  TokenKind,
  WORKDAYS,
  type CaptureContext,
  type CaptureParser,
  type CaptureResult,
  type CaptureToken,
  type IsoDate,
  type IsoTime,
  type RecurrenceRule,
  type Weekday,
} from '@orbit/types';
import {
  addDays,
  addMonths,
  daysInMonth,
  dayOfWeek,
  formatIsoDate,
  parseIsoDate,
  startOfWeek,
  todayInTimeZone,
} from '@orbit/utils';

/**
 * Quick capture zonder AI.
 *
 * "Bel morgen om 14:00 met de boekhouder" wordt:
 *   titel     Bel met de boekhouder
 *   datum     morgen
 *   tijd      14:00
 *
 * De parser is opzettelijk regelgebaseerd en volledig lokaal: hij werkt offline,
 * kost geen milliseconde en heeft geen API-sleutel nodig. Hij implementeert
 * `CaptureParser`, dus er kan later een AI-variant naast zonder dat de UI of de
 * opslag verandert (zie ARCHITECTURE.md §1, requirement 6).
 */

interface Claim {
  start: number;
  end: number;
}

interface MatchContext {
  today: IsoDate;
  ctx: CaptureContext;
}

interface Rule {
  kind: TokenKind;
  pattern: RegExp;
  confidence: number;
  /** Geeft `false` terug om de match te weigeren (bijvoorbeeld bij een onmogelijke datum). */
  apply(match: RegExpExecArray, draft: Draft, ctx: MatchContext): boolean;
}

interface Draft {
  type: ItemType;
  dueDate: IsoDate | null;
  dueTime: IsoTime | null;
  priority: Priority | null;
  tagNames: string[];
  projectName: string | null;
  recurrence: RecurrenceRule | null;
  estimateMinutes: number | null;
}

const WEEKDAY_BY_NAME: Record<string, Weekday> = {
  maandag: 'MO', ma: 'MO', monday: 'MO', mon: 'MO',
  dinsdag: 'TU', di: 'TU', tuesday: 'TU', tue: 'TU',
  woensdag: 'WE', wo: 'WE', wednesday: 'WE', wed: 'WE',
  donderdag: 'TH', do: 'TH', thursday: 'TH', thu: 'TH',
  vrijdag: 'FR', vr: 'FR', friday: 'FR', fri: 'FR',
  zaterdag: 'SA', za: 'SA', saturday: 'SA', sat: 'SA',
  zondag: 'SU', zo: 'SU', sunday: 'SU', sun: 'SU',
};

const WEEKDAY_TO_INDEX: Record<Weekday, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

const MONTH_BY_NAME: Record<string, number> = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maart: 3, mrt: 3, march: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  augustus: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  een: 1, één: 1, one: 1, a: 1, an: 1,
  twee: 2, two: 2,
  drie: 3, three: 3,
  vier: 4, four: 4,
  vijf: 5, five: 5,
  zes: 6, six: 6,
  zeven: 7, seven: 7,
  acht: 8, eight: 8,
  negen: 9, nine: 9,
  tien: 10, ten: 10,
};

const WEEKDAY_NAMES = Object.keys(WEEKDAY_BY_NAME).filter((name) => name.length > 2).join('|');
const MONTH_NAMES = Object.keys(MONTH_BY_NAME).join('|');

type TimeUnit = 'day' | 'week' | 'month' | 'year';

/**
 * Let op de Nederlandse meervouden: "weken" begint niet met "week" en "jaren"
 * niet met "jaar". Een prefixcheck gaat hier dus stilzwijgend de mist in.
 */
function toTimeUnit(raw: string | undefined): TimeUnit {
  const unit = (raw ?? '').toLowerCase();
  if (/^(dag|dagen|day|days)$/.test(unit)) return 'day';
  if (/^(week|weken|weeks)$/.test(unit)) return 'week';
  if (/^(maand|maanden|month|months)$/.test(unit)) return 'month';
  return 'year';
}

const FREQ_BY_UNIT: Record<TimeUnit, RecurrenceFreq> = {
  day: RecurrenceFreq.Daily,
  week: RecurrenceFreq.Weekly,
  month: RecurrenceFreq.Monthly,
  year: RecurrenceFreq.Yearly,
};

function toNumber(raw: string | undefined, fallback = 1): number {
  if (!raw) return fallback;
  const digits = Number.parseInt(raw, 10);
  if (Number.isFinite(digits)) return digits;
  return NUMBER_WORDS[raw.toLowerCase()] ?? fallback;
}

/**
 * "vrijdag" is de eerstvolgende vrijdag; als het vandaag vrijdag is, is dat
 * vandaag. Met "aanstaande" of "volgende" ervoor schuift een nuldag door naar
 * volgende week — dezelfde interpretatie die Todoist hanteert.
 */
function nextWeekday(today: IsoDate, weekday: Weekday, forceNextWeek: boolean): IsoDate {
  const delta = (WEEKDAY_TO_INDEX[weekday] - dayOfWeek(today) + 7) % 7;
  return addDays(today, delta === 0 && forceNextWeek ? 7 : delta);
}

function formatTime(hour: number, minute: number): IsoTime {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function clampDay(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return formatIsoDate({ year, month, day });
}

/** Kiest het eerstvolgende jaar waarin dag/maand nog niet voorbij is. */
function resolveYearlessDate(today: IsoDate, month: number, day: number): IsoDate | null {
  const { year } = parseIsoDate(today);
  const thisYear = clampDay(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return clampDay(year + 1, month, day);
}

// ---------------------------------------------------------------------------
// Regels, in volgorde van specificiteit. De eerste die een stuk tekst claimt
// wint; latere regels mogen daar niet meer overheen.
// ---------------------------------------------------------------------------

const RULES: Rule[] = [
  // --- Itemtype -----------------------------------------------------------
  {
    kind: TokenKind.Type,
    pattern: /^\s*(idee|idea|notitie|note|taak|task)\s*[:!-]\s*/i,
    confidence: 0.95,
    apply(match, draft) {
      const keyword = (match[1] ?? '').toLowerCase();
      draft.type =
        keyword === 'idee' || keyword === 'idea'
          ? ItemType.Idea
          : keyword === 'notitie' || keyword === 'note'
            ? ItemType.Note
            : ItemType.Task;
      return true;
    },
  },

  // --- Herhaling (vóór de weekdag-regel, anders eet die "elke maandag" op) --
  {
    kind: TokenKind.Recurrence,
    pattern: /\b(?:elke|iedere|every)\s+(?:werkdag|weekdag|weekday)\b/i,
    confidence: 0.95,
    apply(_match, draft) {
      draft.recurrence = {
        freq: RecurrenceFreq.Weekly,
        interval: 1,
        byWeekday: [...WORKDAYS],
        anchor: RecurrenceAnchor.Schedule,
      };
      return true;
    },
  },
  {
    kind: TokenKind.Recurrence,
    pattern: new RegExp(String.raw`\b(?:elke|iedere|every)\s+(${WEEKDAY_NAMES})\b`, 'i'),
    confidence: 0.9,
    apply(match, draft) {
      const weekday = WEEKDAY_BY_NAME[(match[1] ?? '').toLowerCase()];
      if (!weekday) return false;
      draft.recurrence = {
        freq: RecurrenceFreq.Weekly,
        interval: 1,
        byWeekday: [weekday],
        anchor: RecurrenceAnchor.Schedule,
      };
      return true;
    },
  },
  {
    kind: TokenKind.Recurrence,
    pattern: /\b(dagelijks|daily|wekelijks|weekly|maandelijks|monthly|jaarlijks|yearly|annually)\b/i,
    confidence: 0.9,
    apply(match, draft) {
      const word = (match[1] ?? '').toLowerCase();
      const freq = word.startsWith('dag') || word === 'daily'
        ? RecurrenceFreq.Daily
        : word.startsWith('week') || word === 'wekelijks'
          ? RecurrenceFreq.Weekly
          : word.startsWith('maand') || word === 'monthly'
            ? RecurrenceFreq.Monthly
            : RecurrenceFreq.Yearly;
      draft.recurrence = { freq, interval: 1, anchor: RecurrenceAnchor.Schedule };
      return true;
    },
  },
  {
    kind: TokenKind.Recurrence,
    pattern:
      /\b(?:elke|iedere|every|om de)\s+(\d{1,3}|twee|drie|vier|vijf|zes|two|three|four|five|six)?\s*(dagen|dag|weken|week|maanden|maand|jaren|jaar|days|day|weeks|months|month|years|year)\b/i,
    confidence: 0.85,
    apply(match, draft) {
      draft.recurrence = {
        freq: FREQ_BY_UNIT[toTimeUnit(match[2])],
        interval: toNumber(match[1], 1),
        anchor: RecurrenceAnchor.Schedule,
      };
      return true;
    },
  },

  // --- Expliciete syntax --------------------------------------------------
  {
    kind: TokenKind.Project,
    pattern: /(?:^|\s)#([\p{L}\p{N}_-]{1,60})/u,
    confidence: 1,
    apply(match, draft) {
      if (draft.projectName) return false;
      draft.projectName = match[1] ?? null;
      return true;
    },
  },
  {
    kind: TokenKind.Tag,
    pattern: /(?:^|\s)@([\p{L}\p{N}_-]{1,60})/u,
    confidence: 1,
    apply(match, draft) {
      const name = match[1];
      if (!name || draft.tagNames.includes(name)) return false;
      draft.tagNames.push(name);
      return true;
    },
  },
  {
    kind: TokenKind.Priority,
    pattern: /(?:^|\s)(?:!([1-4])|p([1-4]))\b/i,
    confidence: 0.95,
    apply(match, draft) {
      const level = Number(match[1] ?? match[2]);
      draft.priority =
        level === 1 ? Priority.Urgent : level === 2 ? Priority.High : level === 3 ? Priority.Medium : Priority.Low;
      return true;
    },
  },
  {
    kind: TokenKind.Priority,
    pattern: /\b(urgent|dringend|spoed|asap)\b/i,
    confidence: 0.7,
    apply(_match, draft) {
      draft.priority = Priority.Urgent;
      return true;
    },
  },
  {
    kind: TokenKind.Priority,
    pattern: /\b(belangrijk|important)\b/i,
    confidence: 0.6,
    apply(_match, draft) {
      draft.priority = Priority.High;
      return true;
    },
  },

  // --- Tijd ---------------------------------------------------------------
  // Staat bewust vóór de tijdsduur: in "om 14 uur" is 14 een klokstand, in
  // "2 uur werken" een duur. Het onderscheid zit in het voorzetsel, en de
  // eerste regel die de tekst claimt wint.
  {
    kind: TokenKind.Time,
    pattern: /(?:\b(?:om|at)\s+)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?:\s*(am|pm|u))?/i,
    confidence: 0.95,
    apply(match, draft) {
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const suffix = (match[3] ?? '').toLowerCase();
      if (suffix === 'pm' && hour < 12) hour += 12;
      if (suffix === 'am' && hour === 12) hour = 0;
      draft.dueTime = formatTime(hour, minute);
      return true;
    },
  },
  {
    kind: TokenKind.Time,
    pattern: /\b(?:om|at)\s+([01]?\d|2[0-3])\s*(?:uur|u|h)\b(?:\s*([0-5]\d))?/i,
    confidence: 0.9,
    apply(match, draft) {
      draft.dueTime = formatTime(Number(match[1]), Number(match[2] ?? 0));
      return true;
    },
  },
  {
    kind: TokenKind.Time,
    pattern: /\b(1[0-2]|[1-9])\s*(am|pm)\b/i,
    confidence: 0.9,
    apply(match, draft) {
      let hour = Number(match[1]);
      if ((match[2] ?? '').toLowerCase() === 'pm' && hour < 12) hour += 12;
      if ((match[2] ?? '').toLowerCase() === 'am' && hour === 12) hour = 0;
      draft.dueTime = formatTime(hour, 0);
      return true;
    },
  },
  {
    kind: TokenKind.Time,
    pattern: /\b(vanochtend|vanmorgen|vanmiddag|vanavond|tonight|this morning|this afternoon|this evening)\b/i,
    confidence: 0.8,
    apply(match, draft, { today }) {
      const word = (match[1] ?? '').toLowerCase();
      const hour = word.includes('ochtend') || word.includes('morgen') || word.includes('morning')
        ? 9
        : word.includes('middag') || word.includes('afternoon')
          ? 14
          : 20;
      draft.dueTime = formatTime(hour, 0);
      draft.dueDate ??= today;
      return true;
    },
  },

  // --- Tijdsduur ----------------------------------------------------------
  {
    kind: TokenKind.Duration,
    pattern: /\b(\d{1,3})\s*(?:min|minuten|minutes|mins)\b/i,
    confidence: 0.85,
    apply(match, draft) {
      draft.estimateMinutes = toNumber(match[1], 30);
      return true;
    },
  },
  {
    kind: TokenKind.Duration,
    pattern: /\b(\d{1,2})\s*(?:uur|hours?|hrs?)\b(?!\s*\d)/i,
    confidence: 0.7,
    apply(match, draft) {
      draft.estimateMinutes = toNumber(match[1], 1) * 60;
      return true;
    },
  },

  // --- Datum --------------------------------------------------------------
  {
    kind: TokenKind.Date,
    pattern: /\b(vandaag|today)\b/i,
    confidence: 1,
    apply(_match, draft, { today }) {
      draft.dueDate = today;
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(overmorgen|day after tomorrow)\b/i,
    confidence: 1,
    apply(_match, draft, { today }) {
      draft.dueDate = addDays(today, 2);
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(morgen|tomorrow)\b/i,
    confidence: 1,
    apply(_match, draft, { today }) {
      draft.dueDate = addDays(today, 1);
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(?:volgende|komende|next)\s+week\b/i,
    confidence: 0.9,
    apply(_match, draft, { today, ctx }) {
      draft.dueDate = addDays(startOfWeek(today, ctx.weekStartsOn), 7);
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(?:volgende|next)\s+maand|next month\b/i,
    confidence: 0.85,
    apply(_match, draft, { today }) {
      const { year, month } = parseIsoDate(addMonths(today, 1));
      draft.dueDate = formatIsoDate({ year, month, day: 1 });
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(dit\s+weekend|this\s+weekend|het\s+weekend)\b/i,
    confidence: 0.8,
    apply(_match, draft, { today }) {
      draft.dueDate = nextWeekday(today, 'SA', false);
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: /\b(?:eind(?:e)?\s+(?:van\s+)?(?:de\s+)?maand|end of (?:the )?month)\b/i,
    confidence: 0.8,
    apply(_match, draft, { today }) {
      const { year, month } = parseIsoDate(today);
      draft.dueDate = formatIsoDate({ year, month, day: daysInMonth(year, month) });
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern:
      /\b(?:over|in)\s+(\d{1,3}|een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|two|three|four|five)\s*(dagen|dag|weken|week|maanden|maand|days|day|weeks|months|month)\b/i,
    confidence: 0.9,
    apply(match, draft, { today }) {
      const amount = toNumber(match[1], 1);
      switch (toTimeUnit(match[2])) {
        case 'day':
          draft.dueDate = addDays(today, amount);
          break;
        case 'week':
          draft.dueDate = addDays(today, amount * 7);
          break;
        default:
          draft.dueDate = addMonths(today, amount);
      }
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: new RegExp(
      String.raw`\b(?:(aanstaande|komende|volgende|a\.s\.|next)\s+)?(${WEEKDAY_NAMES})\b`,
      'i',
    ),
    confidence: 0.85,
    apply(match, draft, { today }) {
      const weekday = WEEKDAY_BY_NAME[(match[2] ?? '').toLowerCase()];
      if (!weekday) return false;
      draft.dueDate = nextWeekday(today, weekday, Boolean(match[1]));
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: new RegExp(String.raw`\b(\d{1,2})\s+(${MONTH_NAMES})\b(?:\s+(\d{4}))?`, 'i'),
    confidence: 0.9,
    apply(match, draft, { today }) {
      const day = Number(match[1]);
      const month = MONTH_BY_NAME[(match[2] ?? '').toLowerCase()];
      if (!month) return false;
      const date = match[3]
        ? clampDay(Number(match[3]), month, day)
        : resolveYearlessDate(today, month, day);
      if (!date) return false;
      draft.dueDate = date;
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    pattern: new RegExp(String.raw`\b(${MONTH_NAMES})\s+(\d{1,2})\b(?:,?\s+(\d{4}))?`, 'i'),
    confidence: 0.85,
    apply(match, draft, { today }) {
      const month = MONTH_BY_NAME[(match[1] ?? '').toLowerCase()];
      const day = Number(match[2]);
      if (!month) return false;
      const date = match[3]
        ? clampDay(Number(match[3]), month, day)
        : resolveYearlessDate(today, month, day);
      if (!date) return false;
      draft.dueDate = date;
      return true;
    },
  },
  {
    kind: TokenKind.Date,
    // Europees formaat: dag eerst. De app is Nederlandstalig, dus 3/4 is 3 april.
    pattern: /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
    confidence: 0.75,
    apply(match, draft, { today }) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const rawYear = match[3];
      if (!rawYear) {
        const date = resolveYearlessDate(today, month, day);
        if (!date) return false;
        draft.dueDate = date;
        return true;
      }
      const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      const date = clampDay(year, month, day);
      if (!date) return false;
      draft.dueDate = date;
      return true;
    },
  },
];

function overlaps(claims: Claim[], start: number, end: number): boolean {
  return claims.some((claim) => start < claim.end && end > claim.start);
}

/** Haalt de geclaimde stukken uit de tekst en ruimt de restanten op. */
function buildTitle(raw: string, claims: Claim[]): string {
  const sorted = [...claims].sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = 0;
  for (const claim of sorted) {
    result += raw.slice(cursor, claim.start);
    result += ' ';
    cursor = claim.end;
  }
  result += raw.slice(cursor);

  return result
    .replace(/\s+/g, ' ')
    // Voorzetsels die alleen bij het weggehaalde stuk hoorden.
    .replace(/\s+(om|op|at|on)\s*$/i, '')
    .replace(/^\s*(om|op|at|on)\s+/i, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim();
}

export class RuleBasedCaptureParser implements CaptureParser {
  readonly name = 'rule-based';

  parse(input: string, ctx: CaptureContext): CaptureResult {
    const raw = input;
    const today = todayInTimeZone(ctx.now, ctx.timeZone);
    const matchContext: MatchContext = { today, ctx };

    const draft: Draft = {
      type: ItemType.Task,
      dueDate: null,
      dueTime: null,
      priority: null,
      tagNames: [],
      projectName: null,
      recurrence: null,
      estimateMinutes: null,
    };

    const claims: Claim[] = [];
    const tokens: CaptureToken[] = [];

    for (const rule of RULES) {
      // Elke regel mag meerdere keren matchen (twee tags bijvoorbeeld), maar
      // nooit over al geclaimde tekst heen.
      const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`);
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(raw)) !== null) {
        if (match[0].length === 0) {
          pattern.lastIndex++;
          continue;
        }
        // Voorloopspatie uit `(?:^|\s)` hoort niet bij de match zelf.
        const leadingWhitespace = /^\s/.test(match[0]) ? 1 : 0;
        const start = match.index + leadingWhitespace;
        const end = match.index + match[0].length;

        if (overlaps(claims, start, end)) continue;
        if (!rule.apply(match, draft, matchContext)) continue;

        claims.push({ start, end });
        tokens.push({
          kind: rule.kind,
          text: raw.slice(start, end).trim(),
          start,
          end,
          confidence: rule.confidence,
        });
      }
    }

    // Een tijd zonder datum betekent vandaag; een datum zonder tijd krijgt de
    // standaardtijd van de gebruiker pas bij het zetten van een reminder.
    if (draft.dueTime && !draft.dueDate) draft.dueDate = today;
    // Een herhaling zonder startdatum begint vandaag.
    if (draft.recurrence && !draft.dueDate) draft.dueDate = today;

    const title = buildTitle(raw, claims);

    return {
      title: title.length > 0 ? title : raw.trim(),
      raw,
      type: draft.type,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      priority: draft.priority,
      tagNames: draft.tagNames,
      projectName: draft.projectName,
      recurrence: draft.recurrence,
      estimateMinutes: draft.estimateMinutes,
      tokens: tokens.sort((a, b) => a.start - b.start),
    };
  }
}

export const ruleBasedParser = new RuleBasedCaptureParser();

/** Handige wrapper voor de UI. */
export function parseQuickCapture(input: string, ctx: CaptureContext): CaptureResult {
  return ruleBasedParser.parse(input, ctx);
}

/** Welke bron we opslaan, afhankelijk van of de parser iets gevonden heeft. */
export function captureSourceFor(result: CaptureResult): CaptureSource {
  return result.tokens.length > 0 ? CaptureSource.Nlp : CaptureSource.Quick;
}
