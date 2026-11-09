import { DEFAULT_LOCALE } from "@/lib/locales";

/**
 * Reads a localized string out of a `{ nl, en, fr, de }` JSON column.
 *
 * Prisma types Json columns as `JsonValue`, which is far wider than the shape we
 * store. Rather than casting, we narrow defensively: anything that is not a
 * usable string falls through the chain requested locale -> nl -> en -> first
 * non-empty value -> `fallback`. Content is authored by hand, so a missing
 * translation must degrade instead of rendering an empty page.
 */
export function localize(value: unknown, locale: string, fallback = ""): string {
  if (typeof value === "string") return value.trim() === "" ? fallback : value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  for (const key of [locale, DEFAULT_LOCALE, "en"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }

  for (const candidate of Object.values(record)) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }

  return fallback;
}

/**
 * Same fallback chain, but for the already-validated `Record<string, string>`
 * maps inside game payloads. Zod guarantees the shape, so this never fails.
 */
export function pickText(text: Record<string, string>, locale: string, fallback = ""): string {
  for (const key of [locale, DEFAULT_LOCALE, "en"]) {
    const candidate = text[key];
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }

  for (const candidate of Object.values(text)) {
    if (candidate.trim() !== "") return candidate;
  }

  return fallback;
}
