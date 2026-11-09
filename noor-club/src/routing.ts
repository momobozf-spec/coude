import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";

/**
 * Kept separate from `src/i18n.ts` on purpose: `i18n.ts` pulls in
 * `next-intl/server`, and `navigation.ts` (used by client components) must not
 * drag that into the browser bundle. Both import routing from here instead.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
