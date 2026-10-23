/**
 * Static product identity.
 *
 * No domain or mailbox is hard-coded here: the deployment URL comes from
 * `APP_URL` (src/config/app-url.ts) and the contact address from
 * `LEGAL_CONTACT_EMAIL` (src/config/legal.ts), so the app never points members
 * at an address nobody reads.
 */
export const siteConfig = {
  name: 'Muslim Life',
  tagline: 'Live with intention.',
  description:
    'Your Muslim life, organized. Prayer, planner, habits, halal discovery and an assistant that helps you plan — in one calm, private place.',
  locales: ['en', 'nl', 'fr', 'ar'] as const,
  defaultLocale: 'en' as const,
  rtlLocales: ['ar'] as const,
} as const

export type Locale = (typeof siteConfig.locales)[number]

export function isRtlLocale(locale: string): boolean {
  return (siteConfig.rtlLocales as readonly string[]).includes(locale)
}
