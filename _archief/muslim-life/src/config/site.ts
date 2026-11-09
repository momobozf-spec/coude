export const siteConfig = {
  name: 'Muslim Life',
  tagline: 'Live with intention.',
  description:
    'Your Muslim life, organized. Prayer, planner, habits, halal discovery and an assistant that helps you plan — in one calm, private place.',
  url: 'https://muslimlife.app',
  locales: ['en', 'nl', 'fr', 'ar'] as const,
  defaultLocale: 'en' as const,
  rtlLocales: ['ar'] as const,
  support: {
    email: 'hello@muslimlife.app',
  },
} as const

export type Locale = (typeof siteConfig.locales)[number]

export function isRtlLocale(locale: string): boolean {
  return (siteConfig.rtlLocales as readonly string[]).includes(locale)
}
