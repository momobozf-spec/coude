"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { translations, Locale, LOCALE_LABELS } from "./translations";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("noor-locale") as Locale | null;
    if (saved && translations[saved]) {
      setLocaleState(saved);
    } else {
      // Auto-detect from browser
      const browserLang = navigator.language.slice(0, 2) as Locale;
      if (translations[browserLang]) {
        setLocaleState(browserLang);
      }
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("noor-locale", newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[locale]?.[key] || translations.en[key] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { LOCALE_LABELS };
export type { Locale };
