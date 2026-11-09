import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n";

/** Haalt de taal uit de route-params en geeft t() terug; onbekende taal = 404. */
export async function localeFromParams(params: Promise<{ locale: string }>): Promise<{ locale: Locale; t: ReturnType<typeof getT> }> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, t: getT(locale) };
}

export function href(locale: Locale, path: string) {
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatDate(d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-BE" : "nl-BE", { timeZone: "Europe/Brussels", ...opts }).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | string, locale: Locale) {
  return formatDate(d, locale, { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function formatIsoDate(iso: string, locale: Locale) {
  return formatDate(new Date(`${iso}T12:00:00Z`), locale, { weekday: "short", day: "numeric", month: "long" });
}
