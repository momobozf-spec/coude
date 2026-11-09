import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteConfig, isRtlLocale } from '@/config/site'
import {
  CATALOGUES,
  getTranslator,
  localeFromAcceptLanguage,
  resolveLocale,
} from '@/i18n'

/**
 * Translation catalogues.
 *
 * The comparison against English is the important one: a locale missing a key
 * silently falls back to English at runtime, which is a reasonable behaviour and
 * a terrible thing to discover in production. Here it is a failure.
 */

function loadCatalogue(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8'),
  ) as Record<string, unknown>
}

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

function leafValues(value: unknown, prefix = ''): [string, string][] {
  if (typeof value !== 'object' || value === null) return [[prefix, String(value)]]

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafValues(child, prefix ? `${prefix}.${key}` : key),
  )
}

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort()
}

const english = loadCatalogue('en')
const englishKeys = leafKeys(english).sort()
const translated = siteConfig.locales.filter((locale) => locale !== 'en')

describe('catalogue completeness', () => {
  it.each(translated)('%s has exactly the same keys as English', (locale) => {
    const keys = leafKeys(loadCatalogue(locale)).sort()

    const missing = englishKeys.filter((key) => !keys.includes(key))
    const extra = keys.filter((key) => !englishKeys.includes(key))

    expect(missing, `missing in ${locale}`).toEqual([])
    expect(extra, `not in English: ${locale}`).toEqual([])
  })

  it.each(translated)('%s uses the same placeholders as English', (locale) => {
    const values = new Map(leafValues(loadCatalogue(locale)))

    for (const [key, englishValue] of leafValues(english)) {
      const translatedValue = values.get(key)
      if (translatedValue === undefined) continue

      // A translation that drops `{minutes}` renders "in  minutes"; one that
      // invents `{minuten}` renders the token itself. Both are shipped bugs.
      expect(placeholders(translatedValue), `${locale}: ${key}`).toEqual(
        placeholders(englishValue),
      )
    }
  })

  it.each(translated)('%s has no empty strings', (locale) => {
    for (const [key, value] of leafValues(loadCatalogue(locale))) {
      if (key.startsWith('_meta')) continue
      expect(value.trim().length, `${locale}: ${key}`).toBeGreaterThan(0)
    }
  })
})

describe('translation honesty', () => {
  it('marks every non-English catalogue as unreviewed', () => {
    // The moment a native speaker signs one off, this test is the thing that
    // has to be updated deliberately — the status cannot drift quietly.
    for (const locale of translated) {
      expect(CATALOGUES[locale].status, locale).toBe('machine-unreviewed')
    }
  })

  it('refuses a reviewed claim with no named reviewer', () => {
    // Guards against someone clearing the notice by editing one word.
    for (const locale of siteConfig.locales) {
      const info = CATALOGUES[locale]
      if (info.status === 'reviewed') {
        expect(info.reviewedBy.length, locale).toBeGreaterThan(0)
      }
    }
  })

  it('does not claim Arabic has been religiously reviewed', () => {
    const meta = loadCatalogue('ar')._meta as Record<string, string>

    expect(meta.status).toBe('machine-unreviewed')
    expect(meta.reviewedBy).toBe('')
  })

  it('exposes the unreviewed state through the translator', () => {
    expect(getTranslator('en').isUnreviewed).toBe(false)
    expect(getTranslator('ar').isUnreviewed).toBe(true)
  })
})

describe('locale resolution', () => {
  it('accepts supported locales', () => {
    for (const locale of siteConfig.locales) {
      expect(resolveLocale(locale)).toBe(locale)
    }
  })

  it('falls back to English for anything unsupported', () => {
    expect(resolveLocale('de')).toBe('en')
    expect(resolveLocale('')).toBe('en')
    expect(resolveLocale(null)).toBe('en')
    expect(resolveLocale('../../etc/passwd')).toBe('en')
  })

  it('serves the base language for a regional tag', () => {
    // A Belgian browser sends `nl-BE`; refusing it would send them English.
    expect(resolveLocale('nl-BE')).toBe('nl')
    expect(resolveLocale('fr-CA')).toBe('fr')
    expect(resolveLocale('AR-EG')).toBe('ar')
  })

  it('honours Accept-Language quality values', () => {
    expect(localeFromAcceptLanguage('de,fr;q=0.9,en;q=0.8')).toBe('fr')
    expect(localeFromAcceptLanguage('en-GB,en;q=0.9')).toBe('en')
    expect(localeFromAcceptLanguage('nl-BE,nl;q=0.9,en;q=0.5')).toBe('nl')
  })

  it('returns null when nothing matches, so the caller can decide', () => {
    expect(localeFromAcceptLanguage('de,it;q=0.9')).toBeNull()
    expect(localeFromAcceptLanguage(null)).toBeNull()
  })
})

describe('direction', () => {
  it('marks only Arabic as right-to-left', () => {
    expect(isRtlLocale('ar')).toBe(true)
    for (const locale of ['en', 'nl', 'fr']) {
      expect(isRtlLocale(locale), locale).toBe(false)
    }
  })

  it('agrees with what each catalogue declares', () => {
    for (const locale of siteConfig.locales) {
      expect(CATALOGUES[locale].dir, locale).toBe(isRtlLocale(locale) ? 'rtl' : 'ltr')
    }
  })

  it('exposes direction on the translator', () => {
    expect(getTranslator('ar').dir).toBe('rtl')
    expect(getTranslator('nl').dir).toBe('ltr')
  })
})

describe('interpolation', () => {
  it('substitutes named values', () => {
    expect(getTranslator('en')('onboarding.stepOf', { current: 2, total: 5 })).toBe('Step 2 of 5')
  })

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    expect(getTranslator('en')('onboarding.stepOf', { current: 2 })).toContain('{total}')
  })

  it('translates into the requested language', () => {
    expect(getTranslator('nl')('nav.settings')).toBe('Instellingen')
    expect(getTranslator('fr')('nav.settings')).toBe('Paramètres')
    expect(getTranslator('ar')('nav.settings')).toBe('الإعدادات')
  })
})

describe('layout directionality', () => {
  const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

  it('sets lang and dir from the resolved locale', () => {
    expect(layout).toContain('lang={locale}')
    expect(layout).toContain('dir={dir}')
    expect(layout).not.toContain('lang="en"')
  })

  it('does not give the Arabic font the same variable name as the theme token', () => {
    // These collided once: `--font-arabic: var(--font-arabic)` resolved to
    // itself and Arabic fell back to the browser's default serif.
    expect(layout).toContain("variable: '--font-naskh'")

    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')
    expect(css).toContain('--font-arabic: var(--font-naskh)')
  })
})

describe('right-to-left styling', () => {
  const files = [
    'src/modules/notifications/notification-settings.tsx',
    'src/modules/privacy/privacy-controls.tsx',
    'src/app/(app)/app/settings/privacy/page.tsx',
  ]

  it('uses logical properties rather than physical ones in new surfaces', () => {
    // `ml-2` and `text-left` are correct in English and wrong in Arabic. The
    // logical equivalents (`ms-2`, `text-start`) work in both.
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).not.toMatch(/className="[^"]*\bml-\d/)
      expect(source, file).not.toMatch(/className="[^"]*\bmr-\d/)
      expect(source, file).not.toMatch(/className="[^"]*\btext-left\b/)
      expect(source, file).not.toMatch(/className="[^"]*\btext-right\b/)
    }
  })
})
