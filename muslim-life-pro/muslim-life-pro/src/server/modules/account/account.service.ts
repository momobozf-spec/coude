import 'server-only'

import bcrypt from 'bcryptjs'

import { prisma } from '@/server/db/prisma'
import { ConflictError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { enforce } from '@/server/services/rate-limit'
import type { Actor } from '@/server/auth/actor'
import { METHOD_BY_COUNTRY } from '@/lib/prayer/types'
import { PRIVACY_VERSION } from '@/config/legal'
import {
  onboardingSchema,
  registerSchema,
  type OnboardingInput,
  type RegisterInput,
} from '@/server/modules/account/account.schema'

const BCRYPT_COST = 12

/**
 * Register a new user with email + password.
 *
 * Creates the Subscription and UserPreference rows in the same transaction as the
 * User, so an actor never exists without them (the Auth.js `createUser` event only
 * fires for adapter-created accounts, i.e. OAuth).
 */
export async function registerUser(input: RegisterInput, ipAddress: string) {
  // An unknown address would put every visitor into ONE shared bucket and let
  // five sign-ups an hour lock registration for everyone; skip rather than that.
  if (ipAddress !== 'unknown') await enforce('auth.register', ipAddress)

  const data = registerSchema.parse(input)

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  })
  if (existing) throw new ConflictError('An account with this email already exists.')

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST)

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      // `data.consent` is the literal `true` — the schema refuses anything else.
      consentedAt: new Date(),
      consentVersion: PRIVACY_VERSION,
      subscription: { create: {} },
      preference: { create: {} },
    },
    select: { id: true, email: true, name: true },
  })

  logger.info('account.registered', { userId: user.id })
  return user
}

/** Countries and cities available during onboarding. */
export async function getOnboardingLocations() {
  return prisma.country.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      cities: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, latitude: true, longitude: true, timezone: true },
      },
    },
  })
}

/**
 * Complete onboarding: write preferences, copy the city's coordinates and
 * timezone onto the user, and stamp `onboardedAt`.
 */
export async function completeOnboarding(actor: Actor, input: OnboardingInput) {
  const data = onboardingSchema.parse(input)

  const city = await prisma.city.findFirst({
    where: { id: data.cityId, countryId: data.countryId, isActive: true },
    select: { id: true, latitude: true, longitude: true, timezone: true },
  })
  if (!city) throw new NotFoundError('City')

  await prisma.$transaction([
    prisma.user.update({
      where: { id: actor.userId },
      data: { name: data.name, timezone: city.timezone, onboardedAt: new Date() },
    }),
    prisma.userPreference.upsert({
      where: { userId: actor.userId },
      create: {
        userId: actor.userId,
        countryId: data.countryId,
        cityId: city.id,
        latitude: city.latitude,
        longitude: city.longitude,
        calculationMethod: data.calculationMethod,
        madhab: data.madhab,
        interests: data.interests,
        goals: data.goals,
      },
      update: {
        countryId: data.countryId,
        cityId: city.id,
        latitude: city.latitude,
        longitude: city.longitude,
        calculationMethod: data.calculationMethod,
        madhab: data.madhab,
        interests: data.interests,
        goals: data.goals,
      },
    }),
  ])

  logger.info('account.onboarded', { userId: actor.userId })
}

/** Suggested calculation method for a country, so onboarding pre-selects sensibly. */
export function suggestedMethodForCountry(countryCode: string) {
  return METHOD_BY_COUNTRY[countryCode] ?? 'MUSLIM_WORLD_LEAGUE'
}

/** The full preference record, with the city and country joined. */
export async function getPreferences(actor: Actor) {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: actor.userId },
    include: {
      city: { select: { id: true, name: true, latitude: true, longitude: true, timezone: true } },
      country: { select: { id: true, code: true, name: true } },
    },
  })
  if (!preference) throw new NotFoundError('Preferences')
  return preference
}
