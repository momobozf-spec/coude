import { nl } from "./nl";
import { fr } from "./fr";
import type { Locale } from "./config";

export type Messages = Record<keyof typeof nl, string>;
export type MessageKey = keyof Messages;

const dictionaries: Record<Locale, Messages> = { nl, fr };

/** Vertaalfunctie met eenvoudige {naam}-interpolatie. Onbekende sleutel → sleutel zelf (zichtbaar in tests). */
export function getT(locale: Locale) {
  const dict = dictionaries[locale];
  return function t(key: MessageKey, vars?: Record<string, string | number>): string {
    let s: string = dict[key] ?? nl[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
export type T = ReturnType<typeof getT>;

/** Kiest de juiste taalkolom van een record met *Nl/*Fr-velden. */
export function pick<R extends Record<string, unknown>>(row: R, base: string, locale: Locale): string {
  const key = `${base}${locale === "fr" ? "Fr" : "Nl"}`;
  return String(row[key] ?? row[`${base}Nl`] ?? "");
}
