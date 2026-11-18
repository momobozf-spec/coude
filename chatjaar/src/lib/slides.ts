import type { ChatStats } from "./stats";
import type { AiResult } from "./ai-types";
import { restoreNames } from "./ai-payload";
import { LOCALE_TAG, getDict, numberFormat, type Locale } from "@/i18n/dictionaries";

export type Tone = "grape" | "pink" | "sun" | "sky" | "lilac";

export interface SlideSpec {
  key: string;
  tone: Tone;
  kicker: string;
  /** Short value shown inside the big speech bubble. */
  bubble?: string;
  /** Large headline, usually a person's name. */
  headline?: string;
  body?: string;
  rows?: Array<[string, string]>;
}

export const FREE_SLIDES = 3;

function fmtDate(iso: string, locale: Locale) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
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

/** Builds the full deck. The first FREE_SLIDES slides are the free teaser. */
export function buildSlides(
  stats: ChatStats,
  locale: Locale,
  ai?: AiResult | null,
  codeToName?: Record<string, string>,
): SlideSpec[] {
  const d = getDict(locale).slides;
  const nf = numberFormat(locale);
  const pct = (x: number) => new Intl.NumberFormat(LOCALE_TAG[locale], { style: "percent" }).format(x);
  const out: Omit<SlideSpec, "tone">[] = [];

  // Free teaser.
  out.push({ key: "total", kicker: d.activeDays(nf.format(stats.activeDays)), bubble: nf.format(stats.totalMessages), headline: d.totalMessages, body: d.totalLine(nf.format(stats.totalWords)) });
  out.push({ key: "busiest", kicker: d.busiestDay, headline: fmtDate(stats.busiestDay.date, locale), body: d.busiestDayLine(nf.format(stats.busiestDay.count)) });
  const spammer = stats.awards.find((a) => a.id === "spammer");
  if (spammer) {
    out.push({
      key: "award-spammer",
      kicker: d.awards.spammer.title,
      headline: spammer.winner,
      bubble: nf.format(spammer.value),
      body: d.topSenderLine(pct(spammer.share ?? 0)),
    });
  } else {
    out.push({ key: "days", kicker: d.year(stats.year), bubble: nf.format(stats.activeDays), headline: d.activeDays(nf.format(stats.activeDays)) });
  }

  // Paid deck.
  out.push({ key: "ranking", kicker: d.ranking, rows: stats.members.slice(0, 8).map((m) => [m.name, nf.format(m.messages)]) });
  for (const a of stats.awards) {
    if (a.id === "spammer") continue;
    const copy = d.awards[a.id];
    const value = a.id === "fastest" || a.id === "novelist" ? nf.format(a.value) : nf.format(Math.round(a.value));
    out.push({ key: `award-${a.id}`, kicker: copy.title, headline: a.winner, body: fill(copy.line, { value, share: pct(a.share ?? 0) }) });
  }
  out.push({ key: "peak", kicker: d.peakHour, bubble: `${String(stats.peakHour).padStart(2, "0")}:00`, body: d.peakHourLine(hourLabel(stats.peakHour, locale)) });
  if (stats.longestStreak.days > 1) {
    out.push({
      key: "streak",
      kicker: d.streak,
      bubble: nf.format(stats.longestStreak.days),
      body: d.streakLine(fmtDate(stats.longestStreak.start, locale), fmtDate(stats.longestStreak.end, locale)),
    });
  }
  out.push({
    key: "month",
    kicker: d.year(stats.year),
    headline: d.months[stats.busiestMonth.month],
    body: `${nf.format(stats.busiestMonth.count)} ${d.messagesShort}`,
  });
  if (stats.duo) out.push({ key: "duo", kicker: d.duo, headline: `${stats.duo.a} & ${stats.duo.b}`, body: d.duoLine(nf.format(stats.duo.count)) });
  if (stats.topEmojis.length) out.push({ key: "emojis", kicker: d.emojis, rows: stats.topEmojis.map((e) => [e.emoji, nf.format(e.count)]) });
  if (stats.topWords.length) out.push({ key: "words", kicker: d.words, rows: stats.topWords.map((w) => [w.word, nf.format(w.count)]) });

  if (ai && codeToName) {
    const r = (s: string) => restoreNames(s, codeToName);
    if (ai.personality.title) out.push({ key: "ai-personality", kicker: d.personality, headline: r(ai.personality.title), body: r(ai.personality.description) });
    ai.moments.forEach((m, i) => out.push({ key: `ai-moment-${i}`, kicker: d.moments, headline: r(m.title), body: r(m.description) }));
    ai.roasts.forEach((ro) => out.push({ key: `ai-roast-${ro.member}`, kicker: codeToName[ro.member] ?? d.roast, headline: r(ro.title), body: r(ro.roast) }));
    if (ai.prediction) out.push({ key: "ai-prediction", kicker: d.prediction, body: r(ai.prediction) });
    if (ai.motto) out.push({ key: "ai-motto", kicker: d.motto, headline: `“${r(ai.motto)}”` });
  }

  out.push({ key: "outro", kicker: d.year(stats.year), headline: d.outro, body: d.outroLine });

  return out.map((s, i) => ({ ...s, tone: TONES[i % TONES.length] }));
}
