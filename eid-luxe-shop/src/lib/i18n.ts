"use client";

import { translations } from "@/data/translations";
import { usePreferences } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";

export const useT = () => {
  const mounted = useMounted();
  const langRaw = usePreferences((s) => s.language);
  const language = mounted ? langRaw : "nl";
  return (key: string) => translations[language]?.[key] ?? translations.nl[key] ?? key;
};
