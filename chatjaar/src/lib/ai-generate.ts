import "server-only";
import { BRAND } from "@/lib/brand";
import { aiModel, getAnthropic } from "@/lib/server-config";
import { MAX_PAYLOAD_CHARS, type AiPayload } from "@/lib/ai-payload";
import { isLocale } from "@/i18n/dictionaries";
import type { AiResult } from "@/lib/ai-types";

const CODE = /^Lid [A-Z]{1,2}$/;

function isStringArray(v: unknown, maxItems: number, maxLen: number): v is string[] {
  return Array.isArray(v) && v.length <= maxItems && v.every((s) => typeof s === "string" && s.length <= maxLen);
}

export function validatePayload(raw: unknown): AiPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.lang !== "string" || !isLocale(p.lang)) return null;
  if (typeof p.year !== "number" || p.year < 2009 || p.year > 2100) return null;
  if (!Array.isArray(p.members) || p.members.length < 1 || p.members.length > 12) return null;
  for (const m of p.members) {
    if (!m || typeof m !== "object" || !CODE.test(String((m as { code?: unknown }).code))) return null;
  }
  if (!isStringArray(p.moments, 12, 4000)) return null;
  if (!p.samples || typeof p.samples !== "object") return null;
  for (const [k, v] of Object.entries(p.samples as Record<string, unknown>)) {
    if (!CODE.test(k) || !isStringArray(v, 12, 400)) return null;
  }
  if (JSON.stringify(p).length > MAX_PAYLOAD_CHARS + 5000) return null;
  return p as unknown as AiPayload;
}

const LANGUAGE_NAME = {
  nl: "Dutch (Belgian, informal 'je')",
  fr: "French (informal 'tu', 'vous' for the group)",
  en: "English",
  de: "German (informal 'du', 'ihr' for the group)",
  es: "Spanish (informal 'tú', 'vosotros' for the group)",
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["personality", "moments", "roasts", "prediction", "motto"],
  properties: {
    personality: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description"],
      properties: { title: { type: "string" }, description: { type: "string" } },
    },
    moments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: { title: { type: "string" }, description: { type: "string" } },
      },
    },
    roasts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["member", "title", "roast"],
        properties: { member: { type: "string" }, title: { type: "string" }, roast: { type: "string" } },
      },
    },
    prediction: { type: "string" },
    motto: { type: "string" },
  },
};

function buildPrompt(p: AiPayload): string {
  return [
    `You are the writer of "${BRAND}", a funny year-in-review of a WhatsApp group chat for ${p.year}.`,
    `Write everything in ${LANGUAGE_NAME[p.lang]}.`,
    "Members are anonymised as codes like \"Lid A\". Always refer to people by exactly these codes; never invent names.",
    "",
    "Write:",
    "- personality: a short, playful title for what kind of group this is (max 6 words) and a description of 1-2 sentences.",
    "- moments: up to 3 of the funniest moments, each a short title (max 6 words) and a 1-2 sentence retelling. Only use moments that appear in the excerpts.",
    "- roasts: one per member listed below, a short nickname-style title (max 5 words) and a roast of 1-2 sentences based on their stats and messages.",
    "- prediction: one funny sentence predicting next year for the group.",
    "- motto: the group's motto in max 8 words.",
    "",
    "Tone rules: warm, cheeky teasing that friends would laugh at together and share in the group. Never mock appearance, weight, health, religion, ethnicity, nationality, gender, sexuality, disability, money problems or family situations. Never reveal or hint at private, sexual or sensitive details from the messages. No swearing. If a moment is sensitive or mean, skip it. Keep every text short enough for a phone story slide (max 200 characters per description or roast).",
    "",
    "Member stats (this year):",
    ...p.members.map(
      (m) =>
        `- ${m.code}: ${m.messages} messages, ${m.night} at night, ${m.voice} voice notes, ${m.laughs} laughing messages, ${m.questions} questions, median reply ${m.medianReplyMinutes ?? "n/a"} min`,
    ),
    "",
    "Moments where others laughed (chat excerpts):",
    ...p.moments.map((m, i) => `--- excerpt ${i + 1} ---\n${m}`),
    "",
    "Typical messages per member:",
    ...Object.entries(p.samples).map(([code, lines]) => `${code}:\n${lines.map((l) => `  • ${l}`).join("\n")}`),
  ].join("\n");
}

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}


/** Calls the model and returns a cleaned, length-capped result. Throws on failure. */
export async function generateAi(payload: AiPayload): Promise<AiResult> {
  const message = await getAnthropic().messages.create({
    model: aiModel(),
    max_tokens: 4000,
    messages: [{ role: "user", content: buildPrompt(payload) }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  const text = message.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const parsed = JSON.parse(text) as AiResult;
  const codes = new Set(payload.members.map((m) => m.code));
  return {
    personality: { title: clean(parsed.personality?.title, 80), description: clean(parsed.personality?.description, 260) },
    moments: (parsed.moments ?? []).slice(0, 3).map((m) => ({ title: clean(m.title, 80), description: clean(m.description, 260) })),
    roasts: (parsed.roasts ?? [])
      .filter((r) => codes.has(r.member))
      .slice(0, 12)
      .map((r) => ({ member: r.member, title: clean(r.title, 60), roast: clean(r.roast, 260) })),
    prediction: clean(parsed.prediction, 220),
    motto: clean(parsed.motto, 90),
  };
}
