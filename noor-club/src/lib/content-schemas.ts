import { z } from "zod";
import { ENGINE_NAMES } from "@/lib/game-schemas";
import { AGE_BANDS } from "@/lib/validators";

/**
 * Shapes for the authored files under `content/`.
 *
 * These are deliberately *stricter* than the runtime schemas: authored content
 * must carry all four languages, because a missing translation here would ship
 * a Dutch string into a French family's dashboard. At runtime we still fall
 * back gracefully (see `localize`), but content never gets to rely on that.
 */

const fullText = z.object({
  nl: z.string().min(1),
  en: z.string().min(1),
  fr: z.string().min(1),
  de: z.string().min(1),
});

export type FullText = z.infer<typeof fullText>;

export const contentAssetSchema = z.object({
  kind: z.enum(["WORKSHEET", "STORY", "PARENT_GUIDE", "POSTER"]),
  titles: fullText,
  /**
   * Path relative to `private/assets/`, never a public URL — these files are
   * served by `/api/asset/[assetId]` after an entitlement check. A leading
   * slash or a `..` segment is rejected here rather than at request time.
   */
  fileUrl: z
    .string()
    .min(1)
    .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), {
      message: "fileUrl moet relatief zijn (geen leidende slash)",
    })
    .refine((value) => !value.split(/[/\\]/).includes(".."), {
      message: "fileUrl mag geen .. bevatten",
    }),
  ageBand: z.string().min(1).default("4-9"),
});

export const contentBadgeSchema = z.object({
  slug: z.string().min(1),
  titles: fullText,
  iconUrl: z.string().min(1),
});

export const contentPackSchema = z.object({
  slug: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  isFree: z.boolean(),
  coverUrl: z.string().min(1),
  titles: fullText,
  descriptions: fullText,
  assets: z.array(contentAssetSchema).min(1),
  badges: z.array(contentBadgeSchema).default([]),
});

export const contentGameSchema = z.object({
  slug: z.string().min(1),
  engine: z.enum(ENGINE_NAMES),
  ageBand: z.enum(AGE_BANDS),
  xp: z.number().int().min(1).max(200),
  order: z.number().int().min(0),
  titles: fullText,
  data: z.unknown(),
});

export type ContentPack = z.infer<typeof contentPackSchema>;
export type ContentGame = z.infer<typeof contentGameSchema>;

const REQUIRED_LOCALES = ["nl", "en", "fr", "de"] as const;

/**
 * Walks a game payload looking for `{ nl, en, fr, de }`-shaped maps that are
 * missing a language. Zod cannot express "every i18n map nested anywhere must
 * be complete", so the seed script calls this and reports the paths it finds.
 */
export function findIncompleteTranslations(value: unknown, path = "data"): string[] {
  if (value === null || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findIncompleteTranslations(entry, `${path}[${index}]`));
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const looksLikeI18n =
    keys.length > 0 &&
    keys.every((key) => typeof record[key] === "string") &&
    REQUIRED_LOCALES.some((locale) => keys.includes(locale));

  if (looksLikeI18n) {
    const missing = REQUIRED_LOCALES.filter((locale) => {
      const entry = record[locale];
      return typeof entry !== "string" || entry.trim() === "";
    });
    return missing.length > 0 ? [`${path}: ontbreekt ${missing.join(", ")}`] : [];
  }

  return keys.flatMap((key) => findIncompleteTranslations(record[key], `${path}.${key}`));
}
