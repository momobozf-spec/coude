'use client';

/**
 * Meertaligheid: Nederlands (eerst), Frans en Engels.
 *
 * Zelfde aanpak als in de boetiek-app: een platte, getypeerde dictionary.
 * Een sleutel die in het Frans of Engels ontbreekt, is een compile-fout,
 * geen `undefined` op het scherm. Geen i18n-framework: drie talen en
 * `{naam}`-plaatshouders hebben er geen nodig.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppLocale } from './format';
import { messages, type MessageKey } from './messages';

const LOCALE_KEY = 'superette.locale';

export const APP_LOCALES: readonly AppLocale[] = ['nl', 'fr', 'en'];
export const LOCALE_LABEL: Readonly<Record<AppLocale, string>> = { nl: 'Nederlands', fr: 'Français', en: 'English' };

interface I18nValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  /** Vertaalt een sleutel; `{naam}`-plaatshouders worden ingevuld. */
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectLocale(): AppLocale {
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === 'nl' || stored === 'fr' || stored === 'en') return stored;
  } catch {
    // Opslag geblokkeerd: volg de browser.
  }
  const language = navigator.language.toLowerCase();
  if (language.startsWith('fr')) return 'fr';
  if (language.startsWith('en')) return 'en';
  return 'nl';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('nl');

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'nl' ? 'nl-BE' : locale === 'fr' ? 'fr-BE' : 'en';
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Niet erg: de keuze geldt dan voor deze sessie.
    }
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>): string => translate(locale, key, values),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Zuivere vertaalfunctie, ook bruikbaar buiten React (tests, meldingen). */
export function translate(locale: AppLocale, key: MessageKey, values?: Record<string, string | number>): string {
  const template = messages[locale][key] ?? messages.nl[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (values[name] === undefined ? match : String(values[name])));
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n moet binnen <I18nProvider> gebruikt worden');
  return value;
}
