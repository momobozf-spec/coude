import ar from '@/../messages/ar.json'
import en from '@/../messages/en.json'
import fr from '@/../messages/fr.json'
import nl from '@/../messages/nl.json'
import { isRtlLocale, siteConfig, type Locale } from '@/config/site'

/**
 * Lightweight i18n runtime.
 *
 * Deliberately not next-intl for the MVP: we need translation *keys* enforced
 * everywhere now, but not routed locales yet. Call sites are identical to
 * next-intl's (`t('nav.dashboard')`), so migrating later is a provider swap.
 *
 * All four catalogues are imported statically rather than registered at runtime.
 * A dynamic import would defer the failure of a broken catalogue to whenever a
 * member happens to pick that language; a static one fails the build.
 */

export type Messages = typeof en

/** Dot-separated leaf paths of the message catalogue, e.g. "nav.dashboard". */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type TranslationKey = Leaves<Messages>

/**
 * How much a catalogue can be trusted.
 *
 * `machine-unreviewed` is not a formality. NL, FR and AR were produced by a
 * model and read by nobody qualified. Claiming otherwise in a product that
 * renders religious vocabulary would be a lie with consequences, so the state is
 * recorded in the catalogue, surfaced in the UI, and only a named reviewer in
 * `_meta.reviewedBy` clears it.
 */
export type TranslationStatus = 'source' | 'machine-unreviewed' | 'reviewed'

export interface CatalogueInfo {
  locale: Locale
  /** English name, for admin and documentation surfaces. */
  name: string
  /** The language's own name, for the language picker. */
  nativeName: string
  dir: 'ltr' | 'rtl'
  status: TranslationStatus
  reviewedBy: string
}

const catalogues: Record<Locale, Messages> = {
  en: en as Messages,
  nl: nl as Messages,
  fr: fr as Messages,
  ar: ar as Messages,
}

function readInfo(locale: Locale): CatalogueInfo {
  const meta = catalogues[locale]._meta
  // A catalogue claiming `reviewed` without naming a reviewer is downgraded.
  // Otherwise the notice could be removed by editing one word in a JSON file.
  const claimed = meta.status as TranslationStatus
  const status: TranslationStatus =
    claimed === 'reviewed' && !meta.reviewedBy ? 'machine-unreviewed' : claimed

  return {
    locale,
    name: meta.name,
    nativeName: meta.nativeName,
    dir: meta.dir === 'rtl' ? 'rtl' : 'ltr',
    status,
    reviewedBy: meta.reviewedBy,
  }
}

export const CATALOGUES: Record<Locale, CatalogueInfo> = Object.fromEntries(
  siteConfig.locales.map((locale) => [locale, readInfo(locale)]),
) as Record<Locale, CatalogueInfo>

/** Narrow an arbitrary string to a supported locale, falling back to English. */
export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return siteConfig.defaultLocale

  const lower = value.toLowerCase()
  if ((siteConfig.locales as readonly string[]).includes(lower)) return lower as Locale

  // Accept region subtags: `nl-BE` and `fr-CA` are served their base language.
  const base = lower.split('-')[0]
  if (base && (siteConfig.locales as readonly string[]).includes(base)) return base as Locale

  return siteConfig.defaultLocale
}

/** Best supported locale from an `Accept-Language` header, honouring q-values. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: (tag ?? '').trim(), q: q ? Number.parseFloat(q.split('=')[1] ?? '0') : 1 }
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.q))
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    const lower = tag.toLowerCase()
    if ((siteConfig.locales as readonly string[]).includes(lower)) return lower as Locale
    const base = lower.split('-')[0]
    if (base && (siteConfig.locales as readonly string[]).includes(base)) return base as Locale
  }

  return null
}

function lookup(messages: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        typeof acc === 'object' && acc !== null ? (acc as Record<string, unknown>)[part] : undefined,
      messages,
    )
  return typeof value === 'string' ? value : undefined
}

export type TranslationValues = Record<string, string | number>

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

export interface Translator {
  (key: TranslationKey, values?: TranslationValues): string
  locale: Locale
  dir: 'ltr' | 'rtl'
  /** True when this locale's wording has not been checked by a person. */
  isUnreviewed: boolean
}

/**
 * Build a translator for a locale, falling back to English for missing keys so a
 * partially-translated catalogue never renders a raw key to the user.
 */
export function getTranslator(locale: string = siteConfig.defaultLocale): Translator {
  const resolved = resolveLocale(locale)

  const primary = catalogues[resolved]
  const fallback = catalogues[siteConfig.defaultLocale]

  const t = ((key: TranslationKey, values?: TranslationValues) => {
    const template = lookup(primary, key) ?? lookup(fallback, key)
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Missing translation key: ${key}`)
      }
      return key
    }
    return interpolate(template, values)
  }) as Translator

  t.locale = resolved
  t.dir = isRtlLocale(resolved) ? 'rtl' : 'ltr'
  t.isUnreviewed = CATALOGUES[resolved].status === 'machine-unreviewed'
  return t
}

/** Default English translator — used where no member locale is available. */
export const t = getTranslator('en')
