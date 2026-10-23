import 'server-only'

import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import type { Locale } from '@/config/site'
import { getActor } from '@/server/auth/actor'
import {
  getTranslator,
  localeFromAcceptLanguage,
  resolveLocale,
  type Translator,
} from '@/i18n'

/**
 * Server-side locale resolution.
 *
 * Precedence, most to least specific:
 *
 *  1. The signed-in member's stored preference — an explicit, durable choice.
 *  2. The `ml_locale` cookie — how a signed-out visitor switches language.
 *  3. `Accept-Language` — the browser's own setting, which is a real preference
 *     someone expressed once, just not to us.
 *  4. English.
 *
 * Locale is deliberately *not* the same as timezone or currency. Someone reading
 * Arabic in Brussels wants Arabic text, Brussels prayer times and euros; picking
 * the language must never move their day or their money.
 */

export const LOCALE_COOKIE = 'ml_locale'

/** A year: this is a stated preference, not a session detail. */
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

export const getRequestLocale = cache(async (): Promise<Locale> => {
  const actor = await getActor()
  if (actor?.locale) return resolveLocale(actor.locale)

  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (fromCookie) return resolveLocale(fromCookie)

  const headerStore = await headers()
  return localeFromAcceptLanguage(headerStore.get('accept-language')) ?? 'en'
})

/** The translator for the current request. */
export const getTranslations = cache(async (): Promise<Translator> => {
  return getTranslator(await getRequestLocale())
})
