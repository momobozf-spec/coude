import { File } from "expo-file-system";
import { ChatParseError, parseChat } from "./parser";
import { computeStats, type ChatStats } from "./stats";
import { fingerprint } from "./analyze-core";
import { buildAiBundle, type AiBundle } from "./ai-payload";
import { chatTextFromBytes } from "./readExport";
import type { Locale } from "@/i18n/dictionaries";

export const MIN_MESSAGES = 20;
const MAX_FILE_BYTES = 80 * 1024 * 1024;

export type AnalyzeError = "empty" | "no_messages" | "no_txt_in_zip" | "too_large" | "few_messages" | "generic";

export interface Analysis {
  stats: ChatStats;
  bundle: AiBundle;
  /** Stable id for this chat, used to remember a purchase without storing the chat. */
  fingerprint: string;
}

export type AnalyzeResult = { ok: true; analysis: Analysis } | { ok: false; error: AnalyzeError };

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
}

/** Reads, parses and counts the chat entirely on the device. Nothing is uploaded here. */
export async function analyzeFile(file: PickedFile, locale: Locale): Promise<AnalyzeResult> {
  try {
    const f = new File(file.uri);
    if (f.exists && f.size > MAX_FILE_BYTES) return { ok: false, error: "too_large" };
    const bytes = await f.bytes();
    const text = chatTextFromBytes(bytes, file.name, file.mimeType);
    await new Promise((r) => setTimeout(r, 30)); // let the busy state paint
    const parsed = parseChat(text);
    const stats = computeStats(parsed.messages);
    if (stats.totalMessages < MIN_MESSAGES) return { ok: false, error: "few_messages" };
    const bundle = buildAiBundle(parsed.messages, stats, locale);
    return { ok: true, analysis: { stats, bundle, fingerprint: fingerprint(stats) } };
  } catch (err) {
    if (err instanceof ChatParseError) return { ok: false, error: err.code };
    console.warn("analyze_failed", err);
    return { ok: false, error: "generic" };
  }
}
