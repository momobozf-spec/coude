/**
 * Belgische notatie van geld, hoeveelheden, datums en tijden.
 *
 * Eén plek, zodat "€ 1,79", "1,5 l" en "4 okt. 2026 om 08:00" overal
 * hetzelfde zijn — in de drie talen, altijd in de tijdzone Europe/Brussels.
 */
import type { NormalizedUnit } from '@superette/contracts';
import { eurosToCents, formatBaseQuantity, perUnitLabel, type BaseQuantity } from '@superette/pricing';

export type AppLocale = 'nl' | 'fr' | 'en';

export const INTL_LOCALE: Readonly<Record<AppLocale, string>> = Object.freeze({ nl: 'nl-BE', fr: 'fr-BE', en: 'en-BE' });
export const TIME_ZONE = 'Europe/Brussels';

/** 179 → "€ 1,79" (nl-BE), "1,79 €" (fr-BE), "€1.79" (en-BE). */
export function formatEuro(cents: number, locale: AppLocale = 'nl'): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** 119 per L → "€ 1,19/l". */
export function formatUnitPrice(cents: number, unit: NormalizedUnit, locale: AppLocale = 'nl'): string {
  return `${formatEuro(cents, locale)}/${perUnitLabel(unit, locale)}`;
}

export function formatQuantity(base: BaseQuantity, locale: AppLocale = 'nl'): string {
  return formatBaseQuantity(base, locale);
}

export function formatPercent(value: number, locale: AppLocale = 'nl'): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}

export function formatNumber(value: number, locale: AppLocale = 'nl', maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits }).format(value);
}

export type DateStyle = 'date' | 'dateTime' | 'time' | 'dayMonth';

/** ISO-8601 (of Unix-milliseconden) → Belgische datum/tijd in Europe/Brussels. */
export function formatDate(iso: string | number | Date, locale: AppLocale = 'nl', style: DateStyle = 'date'): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions =
    style === 'date'
      ? { dateStyle: 'medium' }
      : style === 'dateTime'
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : style === 'time'
          ? { timeStyle: 'short' }
          : { day: 'numeric', month: 'short' };

  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: TIME_ZONE }).format(date);
}

/** "3 uur geleden", "gisteren", "over 5 dagen". Valt terug op een datum na 30 dagen. */
export function formatRelative(iso: string | number | Date, locale: AppLocale = 'nl', now: Date = new Date()): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(diffSeconds / 86_400), 'day');

  return formatDate(date, locale, 'date');
}

/**
 * Invoer in een prijsveld → centen. Accepteert "1,79", "1.79", "€ 1,79", "2".
 * Geeft `null` bij lege of onleesbare invoer, nooit een gok.
 */
export function euroInputToCents(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  try {
    return eurosToCents(trimmed);
  } catch {
    return null;
  }
}

/** 179 → "1,79" voor in een invoerveld (altijd komma: Belgisch toetsenbord en verwachting). */
export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const euros = Math.floor(cents / 100);
  const rest = cents - euros * 100;
  return `${euros},${String(rest).padStart(2, '0')}`;
}

/** Lijst in natuurlijke taal: "Delhaize, Lidl of Colruyt". */
export function joinNatural(items: readonly string[], locale: AppLocale = 'nl', conjunction: 'or' | 'and' = 'or'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  const word = conjunction === 'or' ? { nl: 'of', fr: 'ou', en: 'or' }[locale] : { nl: 'en', fr: 'et', en: 'and' }[locale];
  return `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
}
