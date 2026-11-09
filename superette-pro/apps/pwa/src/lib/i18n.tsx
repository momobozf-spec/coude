'use client';

/**
 * Meertaligheid: Nederlands (Vlaams) en Frans.
 *
 * Bewust geen next-intl of i18next. Die brengen routing-magie en een
 * message-compiler mee die je pas nodig hebt bij tientallen talen en
 * pluralisatie-regels. Twee talen en een platte dictionary zijn hier genoeg —
 * en type-veilig: een ontbrekende sleutel in het Frans is een compile-fout,
 * geen `undefined` op het scherm van een Waalse klant.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '@superette/contracts';
import { messages, type MessageKey } from './messages';

const LOCALE_KEY = 'jj.locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Vertaalt een sleutel. Ondersteunt `{naam}`-plaatshouders. */
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('nl');

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === 'nl' || stored === 'fr') {
      setLocaleState(stored);
      return;
    }

    // Geen keuze opgeslagen: volg de browser. Een Franstalige Belg met
    // `fr-BE` in zijn browser hoort geen Nederlands scherm te zien.
    if (navigator.language.toLowerCase().startsWith('fr')) setLocaleState('fr');
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(LOCALE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>): string => {
      const template = messages[locale][key];

      if (!values) return template;

      return template.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n moet binnen <I18nProvider> gebruikt worden');
  return value;
}

/** Formatteert centen als Belgisch bedrag, in de taal van de gebruiker. */
export function useEuro(): (cents: number) => string {
  const { locale } = useI18n();

  return useCallback(
    (cents: number) => new Intl.NumberFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100),
    [locale],
  );
}
