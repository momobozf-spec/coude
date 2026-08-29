import { fr } from '@/i18n/messages/fr';
import { nl, type Messages } from '@/i18n/messages/nl';
import { type Locale, resolveLocale } from '@/i18n/config';

const DICTIONARIES: Record<Locale, Messages> = { nl, fr };

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

export function getMessagesFor(locale: string | undefined | null): Messages {
  return DICTIONARIES[resolveLocale(locale)];
}

/**
 * Vervangt `{placeholders}` in een vertaalde tekst.
 *
 * Ontbreekt een waarde, dan blijft de placeholder staan in plaats van "undefined"
 * te tonen — dat maakt de fout zichtbaar in plaats van hem te verbergen.
 */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Messages };
export { LOCALES, DEFAULT_LOCALE, isLocale, resolveLocale } from '@/i18n/config';
export type { Locale } from '@/i18n/config';
