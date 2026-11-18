"use client";

import { ChatParseError, parseChat, readExportFile } from "./parser";
import { computeStats, type ChatStats } from "./stats";
import { buildAiBundle, type AiBundle } from "./ai-payload";
import type { Locale } from "@/i18n/dictionaries";

export const MIN_MESSAGES = 20;

export type AnalyzeError = "empty" | "no_messages" | "no_txt_in_zip" | "too_large" | "few_messages" | "generic";

export type AnalyzeResult = { ok: true; stats: ChatStats; bundle: AiBundle } | { ok: false; error: AnalyzeError };

export async function analyzeFile(file: File, locale: Locale): Promise<AnalyzeResult> {
  try {
    if (file.size > 80 * 1024 * 1024) return { ok: false, error: "too_large" };
    const text = await readExportFile(file);
    // Let the browser paint the busy state before the heavy work.
    await new Promise((r) => setTimeout(r, 30));
    const parsed = parseChat(text);
    const stats = computeStats(parsed.messages);
    if (stats.totalMessages < MIN_MESSAGES) return { ok: false, error: "few_messages" };
    const bundle = buildAiBundle(parsed.messages, stats, locale);
    return { ok: true, stats, bundle };
  } catch (err) {
    if (err instanceof ChatParseError) return { ok: false, error: err.code };
    console.error(err);
    return { ok: false, error: "generic" };
  }
}
