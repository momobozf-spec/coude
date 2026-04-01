"use client";

import { useI18n, LOCALE_LABELS, Locale } from "@/i18n/context";

const FLAG: Record<Locale, string> = {
  en: "GB",
  nl: "NL",
  fr: "FR",
  de: "DE",
};

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
      aria-label="Select language"
    >
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
        <option key={loc} value={loc}>
          {FLAG[loc]} {LOCALE_LABELS[loc]}
        </option>
      ))}
    </select>
  );
}
