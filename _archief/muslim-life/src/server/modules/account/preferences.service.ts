import 'server-only'

import type { CalculationMethod, Madhab } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface UpdatePrayerSettingsInput {
  countryId: string
  cityId: string
  calculationMethod: CalculationMethod
  madhab: Madhab
}

/**
 * Update prayer configuration.
 *
 * The city's coordinates and timezone are copied onto the user rather than joined
 * at read time: prayer calculation runs on every dashboard load and on the client
 * for the countdown, and it must not depend on a join being present.
 */
export async function updatePrayerSettings(actor: Actor, input: UpdatePrayerSettingsInput) {
  const city = await prisma.city.findFirst({
    where: { id: input.cityId, countryId: input.countryId, isActive: true },
    select: { id: true, latitude: true, longitude: true, timezone: true },
  })
  if (!city) throw new NotFoundError('City')

  await prisma.$transaction([
    prisma.userPreference.update({
      where: { userId: actor.userId },
      data: {
        countryId: input.countryId,
        cityId: city.id,
        latitude: city.latitude,
        longitude: city.longitude,
        calculationMethod: input.calculationMethod,
        madhab: input.madhab,
      },
    }),
    prisma.user.update({
      where: { id: actor.userId },
      data: { timezone: city.timezone },
    }),
  ])

  logger.info('preferences.prayer.updated', { userId: actor.userId })
}

/** Persist the display theme so it follows the user across devices. */
export async function updateTheme(actor: Actor, theme: 'LIGHT' | 'DARK' | 'SYSTEM') {
  await prisma.userPreference.update({
    where: { userId: actor.userId },
    data: { theme },
  })
}

/**
 * Persist the interface language.
 *
 * Only the language. Timezone stays where the member's city put it, and the
 * currency stays EUR — locale, timezone and currency are three separate facts
 * about a person and conflating them is how someone reading Arabic in Antwerp
 * ends up with Makkah prayer times.
 */
export async function updateLocale(actor: Actor, locale: string) {
  await prisma.user.update({
    where: { id: actor.userId },
    data: { locale },
  })

  logger.info('preferences.locale.updated', { locale })
}
