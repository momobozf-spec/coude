/**
 * Datum- en deadlinelogica. Uitgangspunten:
 * - Oorspronkelijke bronwaarde wordt altijd bewaard.
 * - Een tijdstip (instant) wordt alleen berekend als datum, tijd én tijdzone/offset expliciet bekend zijn.
 * - Weergave voor gebruikers in Europe/Brussels.
 */
export const DISPLAY_TZ = "Europe/Brussels";

export type ParsedDeadline = {
  raw: string;
  /** yyyy-mm-dd zoals in de bron (kalenderdatum in de tijdzone van de bron) */
  date: string | null;
  /** hh:mm zoals in de bron */
  time: string | null;
  timeKnown: boolean;
  timezoneKnown: boolean;
  /** Exact tijdstip; null als tijd of tijdzone ontbreekt. */
  instant: Date | null;
  /** Hoe de tijdzone werd vastgesteld (voor transparantie). */
  timezoneBasis: string | null;
};

const OFFSET_RE = /([+-])(\d{2}):?(\d{2})$|Z$/;

function offsetToMinutes(sign: string, hh: string, mm: string) {
  const m = Number(hh) * 60 + Number(mm);
  return sign === "-" ? -m : m;
}

/**
 * TED levert datum en tijd als aparte velden, bv. "2026-11-20+01:00" en "10:00:00+01:00".
 */
export function parseTedDateTime(dateRaw: string | null | undefined, timeRaw: string | null | undefined): ParsedDeadline {
  const raw = [dateRaw, timeRaw].filter(Boolean).join(" ");
  const result: ParsedDeadline = {
    raw,
    date: null,
    time: null,
    timeKnown: false,
    timezoneKnown: false,
    instant: null,
    timezoneBasis: null,
  };
  if (!dateRaw) return result;
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateRaw.trim());
  if (!dm) return result;
  result.date = `${dm[1]}-${dm[2]}-${dm[3]}`;
  if (!timeRaw) return result;
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?(.*)$/.exec(timeRaw.trim());
  if (!tm) return result;
  result.time = `${tm[1]}:${tm[2]}`;
  result.timeKnown = true;
  const tzPart = tm[4]?.trim() ?? "";
  const om = OFFSET_RE.exec(tzPart);
  if (om) {
    const offset = om[0] === "Z" ? 0 : offsetToMinutes(om[1], om[2], om[3]);
    result.timezoneKnown = true;
    result.timezoneBasis = `offset in bronveld (${om[0]})`;
    const utcMs =
      Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), Number(tm[3] ?? 0)) -
      offset * 60_000;
    result.instant = new Date(utcMs);
  }
  return result;
}

const EXPLICIT_BRUSSELS_RE =
  /(belgische tijd|heure belge|heure de bruxelles|brussels time|europe\/brussels|\bCET\b|\bCEST\b|\bMET\b|\bMEZ\b|lokale tijd brussel)/i;

/**
 * Vrije tekst (handmatige invoer of AI-extractie). Interpreteert alleen expliciete vormen.
 * Tijdzone: enkel via expliciete offset of expliciete vermelding van Belgische/Brusselse tijd/CET/CEST.
 */
export function parseFreeTextDeadline(raw: string, context?: string | null): ParsedDeadline {
  const result: ParsedDeadline = {
    raw,
    date: null,
    time: null,
    timeKnown: false,
    timezoneKnown: false,
    instant: null,
    timezoneBasis: null,
  };
  const s = raw.trim();
  let y: number | undefined, mo: number | undefined, d: number | undefined;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const eu = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else if (eu) {
    d = Number(eu[1]);
    mo = Number(eu[2]);
    y = Number(eu[3]);
  }
  if (!y || !mo || !d || mo > 12 || d > 31) return result;
  result.date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const tm = /\b(\d{1,2})\s*(?::|u|h|\.)\s*(\d{2})\b/i.exec(s.replace(result.date, ""));
  if (!tm) return result;
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (hh > 23 || mm > 59) return result;
  result.time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  result.timeKnown = true;

  const offset = /(?:UTC|GMT)?\s*([+-])(\d{2}):?(\d{2})\b/.exec(s.slice(tm.index + tm[0].length));
  if (offset) {
    const off = offsetToMinutes(offset[1], offset[2], offset[3]);
    result.timezoneKnown = true;
    result.timezoneBasis = `expliciete offset (${offset[0].trim()})`;
    result.instant = new Date(Date.UTC(y, mo - 1, d, hh, mm) - off * 60_000);
    return result;
  }
  const explicit = EXPLICIT_BRUSSELS_RE.exec(s) ?? (context ? EXPLICIT_BRUSSELS_RE.exec(context) : null);
  if (explicit) {
    result.timezoneKnown = true;
    result.timezoneBasis = `expliciet vermeld: "${explicit[0]}"`;
    result.instant = zonedToUtc(y, mo, d, hh, mm, DISPLAY_TZ);
  }
  return result;
}

/** Converteert een wandklok-tijd in een IANA-tijdzone naar UTC (DST-correct). */
export function zonedToUtc(y: number, mo: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const offset1 = tzOffsetMinutes(new Date(guess), tz);
  let utc = guess - offset1 * 60_000;
  const offset2 = tzOffsetMinutes(new Date(utc), tz);
  if (offset2 !== offset1) utc = guess - offset2 * 60_000;
  return new Date(utc);
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function formatBrussels(date: Date | string | null | undefined, withTime = true): string {
  if (!date) return "onbekend";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone: DISPLAY_TZ,
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(d);
}

/** Leesbare deadline met eerlijke vermelding van wat ontbreekt. */
export function describeDeadline(f: {
  valueInstant: Date | string | null;
  valueDate: string | null;
  rawValue: string;
  timeKnown: boolean;
  timezoneKnown: boolean;
}): { label: string; caveat: string | null } {
  if (f.valueInstant) return { label: `${formatBrussels(f.valueInstant)} (Brusselse tijd)`, caveat: null };
  if (f.valueDate) {
    const [y, m, d] = f.valueDate.split("-").map(Number);
    const dateLabel = new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
    if (!f.timeKnown) return { label: dateLabel, caveat: "tijdstip niet vermeld in bron" };
    return { label: `${dateLabel}`, caveat: `tijdzone niet vermeld in bron — bronwaarde: "${f.rawValue}"` };
  }
  return { label: "onbekend", caveat: `bronwaarde niet interpreteerbaar: "${f.rawValue}"` };
}

/**
 * Conservatief vergelijkbaar moment voor 'is de deadline verstreken?':
 * - instant bekend → instant
 * - enkel datum → einde van die kalenderdag (23:59:59 Brusselse tijd) zodat we niets te vroeg als verlopen markeren.
 */
export function deadlineComparable(f: { valueInstant: Date | string | null; valueDate: string | null }): Date | null {
  if (f.valueInstant) return new Date(f.valueInstant);
  if (f.valueDate) {
    const [y, m, d] = f.valueDate.split("-").map(Number);
    return zonedToUtc(y, m, d, 23, 59, DISPLAY_TZ);
  }
  return null;
}

/** Voorzichtig: dagen tot deadline volgens het vroegst mogelijke moment (begin van de dag bij enkel datum). */
export function daysUntil(f: { valueInstant: Date | string | null; valueDate: string | null }, now: Date): number | null {
  let t: Date | null = null;
  if (f.valueInstant) t = new Date(f.valueInstant);
  else if (f.valueDate) {
    const [y, m, d] = f.valueDate.split("-").map(Number);
    t = zonedToUtc(y, m, d, 0, 0, DISPLAY_TZ);
  }
  if (!t) return null;
  return Math.floor((t.getTime() - now.getTime()) / 86_400_000);
}
