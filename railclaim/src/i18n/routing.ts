import { defineRouting } from 'next-intl/routing'

export const locales = ['nl', 'fr'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'nl'

export const localeLabels: Record<Locale, string> = {
  nl: 'Nederlands',
  fr: 'Français',
}

/**
 * NL and FR only. These are the two languages NMBS accepts a domestic
 * compensation dossier in, and the claim templates exist in both.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
})

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
