export const LOCALES = ["nl", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";

export function isLocale(x: string | undefined): x is Locale {
  return LOCALES.includes(x as Locale);
}
