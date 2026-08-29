import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { defaultLocale, routing, type Locale } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : defaultLocale

  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
    // Every timetable time in this product is Belgian local time.
    timeZone: 'Europe/Brussels',
    now: new Date(),
  }
})
