import type { ChatStats } from "./stats";
import type { AiResult } from "./ai-types";
import { restoreNames } from "./ai-payload";
import { LOCALE_TAG, getDict, numberFormat, type Locale } from "@/i18n/dictionaries";
import { getAppDict } from "@/i18n/app";

/**
 * App version of the slide deck ("story" v3). Differs from the website's slides.ts: every slide has a
 * layout, people (for avatars), optional chart/summary data and a count-up value.
 */

export type Tone = "grape" | "pink" | "sun" | "sky" | "lilac";
export type Layout = "number" | "person" | "list" | "chart" | "quote" | "roast" | "summary";

export interface SlideSpec {
  key: string;
  tone: Tone;
  layout: Layout;
  kicker: string;
  /** Big value. When countUp is set, the value animates from 0 to countUp. */
  bubble?: string;
  countUp?: number;
  headline?: string;
  body?: string;
  rows?: Array<[string, string]>;
  /** Show an avatar in front of each row (ranking). */
  rowAvatars?: boolean;
  /** Optional 0..1 value drawn as a meter (e.g. share of all messages). */
  meter?: number;
  /** Names shown as initials avatars. */
  people?: string[];
  chart?: { values: number[]; labels: string[]; highlight: number };
  summary?: Array<{ label: string; value: string }>;
}

export const FREE_SLIDES = 3;

function fmtDate(iso: string, locale: Locale) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
}

function hourLabel(h: number, locale: Locale) {
  if (locale === "nl") return `${h} uur`;
  if (locale === "fr") return `${h} h`;
  if (locale === "de") return `${h} Uhr`;
  return `${String(h).padStart(2, "0")}:00`;
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

const TONES: Tone[] = ["grape", "pink", "sun", "sky", "lilac"];

/** Awards whose value is a count (shown counting up); the others are averages with decimals. */
const COUNT_AWARDS = new Set(["spammer", "ghost", "nightOwl", "voiceKing", "starter", "questioner", "laugher", "stickers", "deleter"]);

/** Builds the full deck. The first FREE_SLIDES slides are the free teaser. */
export function buildSlides(stats: ChatStats, locale: Locale, ai?: AiResult | null, codeToName?: Record<string, string>): SlideSpec[] {
  const d = getDict(locale).slides;
  const s = getAppDict(locale).story;
  const nf = numberFormat(locale);
  const pct = (x: number) => new Intl.NumberFormat(LOCALE_TAG[locale], { style: "percent" }).format(x);
  const out: Omit<SlideSpec, "tone">[] = [];

  // ---- Free teaser ----
  out.push({
    key: "total",
    layout: "number",
    kicker: d.activeDays(nf.format(stats.activeDays)),
    bubble: nf.format(stats.totalMessages),
    countUp: stats.totalMessages,
    headline: d.totalMessages,
    body: d.totalLine(nf.format(stats.totalWords)),
  });
  out.push({
    key: "busiest",
    layout: "number",
    kicker: d.busiestDay,
    bubble: nf.format(stats.busiestDay.count),
    countUp: stats.busiestDay.count,
    headline: fmtDate(stats.busiestDay.date, locale),
    body: d.busiestDayLine(nf.format(stats.busiestDay.count)),
  });
  const spammer = stats.awards.find((a) => a.id === "spammer");
  if (spammer) {
    out.push({
      key: "award-spammer",
      layout: "person",
      kicker: d.awards.spammer.title,
      people: [spammer.winner],
      headline: spammer.winner,
      bubble: nf.format(spammer.value),
      countUp: spammer.value,
      body: d.topSenderLine(pct(spammer.share ?? 0)),
      meter: spammer.share ?? 0,
    });
  } else {
    out.push({ key: "days", layout: "number", kicker: d.year(stats.year), bubble: nf.format(stats.activeDays), countUp: stats.activeDays, headline: d.activeDays(nf.format(stats.activeDays)) });
  }

  // ---- Paid deck ----
  out.push({
    key: "ranking",
    layout: "list",
    kicker: d.ranking,
    rows: stats.members.slice(0, 6).map((m) => [m.name, nf.format(m.messages)]),
    rowAvatars: true,
  });

  out.push({
    key: "hours",
    layout: "chart",
    kicker: d.peakHour,
    headline: `${String(stats.peakHour).padStart(2, "0")}:00`,
    body: d.peakHourLine(hourLabel(stats.peakHour, locale)),
    chart: { values: stats.hourCounts, labels: stats.hourCounts.map((_, h) => (h % 6 === 0 ? `${h}h` : "")), highlight: stats.peakHour },
  });

  for (const a of stats.awards) {
    if (a.id === "spammer") continue;
    const copy = d.awards[a.id];
    const isCount = COUNT_AWARDS.has(a.id);
    const value = isCount ? nf.format(Math.round(a.value)) : nf.format(a.value);
    out.push({
      key: `award-${a.id}`,
      layout: "person",
      kicker: copy.title,
      people: [a.winner],
      headline: a.winner,
      bubble: value,
      countUp: isCount ? Math.round(a.value) : undefined,
      body: fill(copy.line, { value, share: pct(a.share ?? 0) }),
    });
  }

  out.push({
    key: "months",
    layout: "chart",
    kicker: s.monthsTitle,
    headline: d.months[stats.busiestMonth.month],
    body: `${nf.format(stats.busiestMonth.count)} ${d.messagesShort}`,
    chart: { values: stats.monthCounts, labels: d.months.map((m) => m.slice(0, 1).toUpperCase()), highlight: stats.busiestMonth.month },
  });

  if (stats.longestStreak.days > 1) {
    out.push({
      key: "streak",
      layout: "number",
      kicker: d.streak,
      bubble: nf.format(stats.longestStreak.days),
      countUp: stats.longestStreak.days,
      headline: s.daysInARow,
      body: d.streakLine(fmtDate(stats.longestStreak.start, locale), fmtDate(stats.longestStreak.end, locale)),
    });
  }
  if (stats.duo) {
    out.push({ key: "duo", layout: "person", kicker: d.duo, people: [stats.duo.a, stats.duo.b], headline: `${stats.duo.a} & ${stats.duo.b}`, body: d.duoLine(nf.format(stats.duo.count)) });
  }
  if (stats.topEmojis.length) out.push({ key: "emojis", layout: "list", kicker: d.emojis, rows: stats.topEmojis.slice(0, 5).map((e) => [e.emoji, nf.format(e.count)]) });
  if (stats.topWords.length) out.push({ key: "words", layout: "list", kicker: d.words, rows: stats.topWords.slice(0, 5).map((w) => [w.word, nf.format(w.count)]) });

  if (ai && codeToName) {
    const r = (x: string) => restoreNames(x, codeToName);
    if (ai.personality.title) out.push({ key: "ai-personality", layout: "quote", kicker: d.personality, headline: r(ai.personality.title), body: r(ai.personality.description) });
    ai.moments.forEach((m, i) => out.push({ key: `ai-moment-${i}`, layout: "quote", kicker: d.moments, headline: r(m.title), body: r(m.description) }));
    ai.roasts.forEach((ro) => {
      const name = codeToName[ro.member] ?? ro.member;
      out.push({ key: `ai-roast-${ro.member}`, layout: "roast", kicker: d.roast, people: [name], headline: r(ro.title), body: r(ro.roast) });
    });
    if (ai.prediction) out.push({ key: "ai-prediction", layout: "quote", kicker: d.prediction, headline: r(ai.prediction) });
    if (ai.motto) out.push({ key: "ai-motto", layout: "quote", kicker: d.motto, headline: `“${r(ai.motto)}”` });
  }

  // ---- Finale: everything on one card ----
  const summary: Array<{ label: string; value: string }> = [
    { label: s.sumMessages, value: nf.format(stats.totalMessages) },
    { label: s.sumActiveDays, value: nf.format(stats.activeDays) },
  ];
  if (spammer) summary.push({ label: d.awards.spammer.title, value: spammer.winner });
  summary.push({ label: d.busiestDay, value: fmtDate(stats.busiestDay.date, locale) });
  if (stats.topEmojis[0]) summary.push({ label: s.sumEmoji, value: stats.topEmojis[0].emoji });
  if (ai?.motto && codeToName) summary.push({ label: d.motto, value: `“${restoreNames(ai.motto, codeToName)}”` });
  out.push({ key: "summary", layout: "summary", kicker: d.year(stats.year), headline: s.summaryTitle, summary, body: d.outroLine });

  return out.map((x, i) => ({ ...x, tone: TONES[i % TONES.length] }));
}
