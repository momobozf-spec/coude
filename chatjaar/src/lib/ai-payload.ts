import type { ChatMessage } from "./parser";
import { LAUGH, type ChatStats } from "./stats";

export type { Locale } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/dictionaries";

/** What leaves the browser for the AI step. Contains no real names, links, numbers or e-mail addresses. */
export interface AiPayload {
  lang: Locale;
  year: number;
  members: Array<{
    code: string;
    messages: number;
    night: number;
    voice: number;
    laughs: number;
    questions: number;
    medianReplyMinutes: number | null;
  }>;
  moments: string[];
  samples: Record<string, string[]>;
}

export interface AiBundle {
  payload: AiPayload;
  /** code -> real name, stays in the browser */
  codeToName: Record<string, string>;
}

const MAX_ROAST_MEMBERS = 12;
const MAX_MOMENTS = 12;
const SAMPLES_PER_MEMBER = 12;
const MAX_LINE = 280;
export const MAX_PAYLOAD_CHARS = 40_000;

export function memberCode(i: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  let n = i;
  do {
    s = letters[n % 26] + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Lid ${s}`;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAiBundle(all: ChatMessage[], stats: ChatStats, lang: Locale): AiBundle {
  const codeToName: Record<string, string> = {};
  const nameToCode = new Map<string, string>();
  stats.members.forEach((m, i) => {
    const code = memberCode(i);
    codeToName[code] = m.name;
    nameToCode.set(m.name, code);
  });

  // Replace full names first, then individual name parts (first names) of 3+ letters.
  const replacements: Array<[RegExp, string]> = [];
  const sortedNames = [...nameToCode.keys()].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    replacements.push([new RegExp(escapeRe(name), "giu"), nameToCode.get(name)!]);
  }
  for (const name of sortedNames) {
    for (const part of name.split(/[\s.,_-]+/)) {
      if (part.length < 3 || /^\+?\d/.test(part)) continue;
      replacements.push([new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(part)}(?![\\p{L}\\p{N}])`, "giu"), nameToCode.get(name)!]);
    }
  }

  const scrub = (text: string) => {
    let t = text
      .replace(/https?:\/\/\S+|www\.\S+/gi, "[link]")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
      .replace(/\+?\d[\d\s/.-]{6,}\d/g, "[nummer]")
      .replace(/@\d{6,}/g, "@[nummer]");
    for (const [re, code] of replacements) t = t.replace(re, code);
    t = t.replace(/\s+/g, " ").trim();
    return t.length > MAX_LINE ? t.slice(0, MAX_LINE) + "…" : t;
  };

  const msgs = all.filter((m) => m.sender && m.ts.getUTCFullYear() === stats.year);
  const line = (m: ChatMessage) => {
    const code = nameToCode.get(m.sender as string) ?? "Lid ?";
    if (m.kind === "media") return `${code}: [${m.mediaType === "audio" ? "spraakbericht" : "media"}]`;
    if (m.kind === "deleted") return `${code}: [verwijderd bericht]`;
    return `${code}: ${scrub(m.text)}`;
  };

  // Funny moments: a text message followed by laughter from other members.
  const scored: Array<{ i: number; score: number }> = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.kind !== "text" || m.text.length < 4) continue;
    const laughers = new Set<string>();
    for (let j = i + 1; j < Math.min(msgs.length, i + 9); j++) {
      const r = msgs[j];
      if (r.ts.getTime() - m.ts.getTime() > 10 * 60_000) break;
      if (r.sender !== m.sender && r.kind === "text" && LAUGH.test(r.text)) laughers.add(r.sender as string);
    }
    if (laughers.size > 0) scored.push({ i, score: laughers.size * 10 + Math.min(m.text.length, 120) / 40 });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked: number[] = [];
  for (const s of scored) {
    if (picked.length >= MAX_MOMENTS) break;
    if (picked.some((p) => Math.abs(p - s.i) < 10)) continue;
    picked.push(s.i);
  }
  picked.sort((a, b) => a - b);
  const moments = picked.map((i) =>
    msgs
      .slice(Math.max(0, i - 4), Math.min(msgs.length, i + 4))
      .map(line)
      .join("\n"),
  );

  // Characteristic samples per member, spread across the year.
  const samples: Record<string, string[]> = {};
  for (const member of stats.members.slice(0, MAX_ROAST_MEMBERS)) {
    const own = msgs.filter((m) => m.sender === member.name && m.kind === "text" && m.text.split(/\s+/).length >= 4);
    const step = Math.max(1, Math.floor(own.length / SAMPLES_PER_MEMBER));
    const chosen: string[] = [];
    for (let i = 0; i < own.length && chosen.length < SAMPLES_PER_MEMBER; i += step) chosen.push(scrub(own[i].text));
    samples[nameToCode.get(member.name)!] = chosen;
  }

  const payload: AiPayload = {
    lang,
    year: stats.year,
    members: stats.members.slice(0, MAX_ROAST_MEMBERS).map((m) => ({
      code: nameToCode.get(m.name)!,
      messages: m.messages,
      night: m.night,
      voice: m.voice,
      laughs: m.laughs,
      questions: m.questions,
      medianReplyMinutes: m.medianReplyMinutes,
    })),
    moments,
    samples,
  };

  // Hard cap on size: drop moments, then samples, until it fits.
  while (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS && payload.moments.length > 3) payload.moments.pop();
  for (const code of Object.keys(payload.samples)) {
    while (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS && payload.samples[code].length > 4) payload.samples[code].pop();
  }

  return { payload, codeToName };
}

/** Swap "Lid A" codes in AI output back to real names (browser only). */
export function restoreNames(text: string, codeToName: Record<string, string>): string {
  const codes = Object.keys(codeToName).sort((a, b) => b.length - a.length);
  let out = text;
  for (const code of codes) out = out.replace(new RegExp(`\\b${escapeRe(code)}\\b`, "g"), codeToName[code]);
  return out;
}
