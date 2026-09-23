import type { Cents, ComparisonUnit, CurrencyCode, Quantity } from '@superrette/shared';
import type { Locale } from '@superrette/domain';
import { createTranslator } from './translator.js';

/** Map an interface language + market to a BCP-47 tag: nl+BE -> nl-BE. */
export function toBcp47(locale: Locale, country: string | null | undefined = 'BE'): string {
  const c = (country ?? 'BE').toUpperCase();
  if (locale === 'en') return c === 'NL' ? 'en-NL' : 'en-BE';
  return `${locale}-${c}`;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
function nf(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, options);
    numberFormats.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  locale: Locale;
  country?: string | null;
  currency?: CurrencyCode;
}

/** "€ 2,49" (nl-BE), "2,49 €" (fr-BE), "€2.49" (en). */
export function formatPrice(cents: Cents, options: FormatOptions): string {
  return nf(toBcp47(options.locale, options.country), {
    style: 'currency',
    currency: options.currency ?? 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "€ 1,33/l", "€ 4,98/kg", "€ 0,33/stuk". */
export function formatUnitPrice(cents: number, per: ComparisonUnit, options: FormatOptions): string {
  const t = createTranslator(options.locale);
  const unit = per === 'piece' ? t('units.piece', { count: 1 }) : t(`units.${per}`);
  return `${formatPrice(Math.round(cents), options)}/${unit}`;
}

export function formatNumber(value: number, options: FormatOptions & { maximumFractionDigits?: number }): string {
  return nf(toBcp47(options.locale, options.country), {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(value);
}

/** "1,5 l", "500 g", "6 x 33 cl"-style pack labels, "12 stuks". */
export function formatQuantity(q: Quantity, options: FormatOptions & { packCount?: number }): string {
  const t = createTranslator(options.locale);
  const amount = formatNumber(q.amount, options);
  const unit = q.unit === 'piece' ? t('units.piece', { count: q.amount }) : t(`units.${q.unit}`);
  const single = `${amount} ${unit}`;
  return options.packCount && options.packCount > 1 ? `${options.packCount} x ${single}` : single;
}

export function formatDate(
  date: Date | string,
  options: FormatOptions & { style?: 'short' | 'medium' | 'long' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const style = options.style ?? 'medium';
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'numeric' }
      : style === 'long'
        ? { dateStyle: 'long' }
        : { day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat(toBcp47(options.locale, options.country), opts).format(d);
}

export function formatPercent(percent: number, options: FormatOptions): string {
  return nf(toBcp47(options.locale, options.country), { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / 100,
  );
}

export type GreetingKey = 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening';
export function greetingKeyFor(date: Date): GreetingKey {
  const h = date.getHours();
  return h < 12 ? 'greeting.morning' : h < 18 ? 'greeting.afternoon' : 'greeting.evening';
}
