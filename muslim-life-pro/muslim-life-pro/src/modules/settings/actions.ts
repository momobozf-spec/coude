'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { siteConfig } from '@/config/site'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/server'
import { requireActor } from '@/server/auth/actor'
import { updateLocale, updatePrayerSettings } from '@/server/modules/account/preferences.service'
import { CALCULATION_METHOD_VALUES } from '@/server/modules/account/account.schema'
import { updateNotificationPreferences } from '@/server/modules/notifications/preferences.service'
import { notificationPreferencesInputSchema } from '@/server/modules/notifications/preferences'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'

const schema = z.object({
  countryId: z.string().uuid(),
  cityId: z.string().uuid(),
  calculationMethod: z.enum(CALCULATION_METHOD_VALUES),
  madhab: z.enum(['SHAFI', 'HANAFI']),
})

export async function updatePrayerSettingsAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const data = schema.parse(input)

    await updatePrayerSettings(actor, data)

    revalidatePath('/app')
    revalidatePath('/app/settings')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

const localeSchema = z.object({ locale: z.enum(siteConfig.locales) })

/**
 * Change the interface language.
 *
 * Written to both the account and a cookie. The account is the durable record;
 * the cookie is what lets the root layout pick a direction before any database
 * read, and what keeps the choice if the member signs out.
 *
 * Note what is *not* touched: timezone, prayer calculation and currency. Reading
 * the app in Arabic must not move someone's prayer times to Riyadh.
 */
export async function updateLocaleAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { locale } = localeSchema.parse(input)

    await updateLocale(actor, locale)

    const cookieStore = await cookies()
    cookieStore.set(LOCALE_COOKIE, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
      // Read on the server only; no client code needs it.
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })

    // Every rendered page carries `lang` and `dir`, so the whole tree is stale.
    revalidatePath('/', 'layout')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function updateNotificationPreferencesAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const data = notificationPreferencesInputSchema.parse(input)

    await updateNotificationPreferences(actor, data)

    revalidatePath('/app/settings/notifications')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
