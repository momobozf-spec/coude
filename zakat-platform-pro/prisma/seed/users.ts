import type { PrismaClient } from '@/generated/prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Development users (§54).
 *
 * Two of them on purpose: the second one exists so that user-isolation problems
 * show up while clicking around, not only in the test suite. Aisha owns data that
 * Mohamed must never see anywhere in the UI.
 */

export const DEV_PASSWORD = 'barakah-dev-2026'

async function provision(prisma: PrismaClient, userId: string, defaultCurrency: string) {
  await prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: { userId, plan: 'FREE' },
  })
  await prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
  await prisma.zakatProfile.upsert({
    where: { userId },
    update: {},
    create: { userId, defaultCurrency },
  })
}

export async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12)

  const mohamed = await prisma.user.upsert({
    where: { email: 'dev@barakah.local' },
    update: { passwordHash },
    create: {
      email: 'dev@barakah.local',
      name: 'Mohamed Bouzouf',
      passwordHash,
      locale: 'nl',
      timezone: 'Europe/Brussels',
      onboardedAt: new Date(),
    },
  })

  const aisha = await prisma.user.upsert({
    where: { email: 'other@barakah.local' },
    update: { passwordHash },
    create: {
      email: 'other@barakah.local',
      name: 'Aisha Demo',
      passwordHash,
      locale: 'nl',
      timezone: 'Europe/Brussels',
      onboardedAt: new Date(),
    },
  })

  await provision(prisma, mohamed.id, 'EUR')
  await provision(prisma, aisha.id, 'EUR')

  // Mohamed gets the Plus plan so every entitlement-gated surface is reachable
  // in development without hand-editing the database.
  await prisma.subscription.update({
    where: { userId: mohamed.id },
    data: { plan: 'FAMILY', status: 'ACTIVE' },
  })

  await prisma.zakatProfile.update({
    where: { userId: mohamed.id },
    data: {
      nisabBasis: 'SILVER',
      zakatDueDate: new Date('2026-03-15T00:00:00Z'),
      haulStartDate: new Date('2025-03-15T00:00:00Z'),
      advancedMode: true,
      businessAssetsEnabled: true,
    },
  })

  return { mohamed, aisha }
}

/**
 * A believable starting position for Mohamed, matching the amounts used in the
 * product spec so the dashboard and (from phase 2) the calculation can be checked
 * against a worked example by hand.
 */
export async function seedFinancials(prisma: PrismaClient, userId: string) {
  await prisma.asset.deleteMany({ where: { userId } })
  await prisma.liability.deleteMany({ where: { userId } })

  await prisma.asset.createMany({
    data: [
      { userId, type: 'SAVINGS', name: 'Spaarrekening', value: '35000.00', currency: 'EUR' },
      { userId, type: 'INVESTMENTS', name: 'Beleggingsrekening', value: '15000.00', currency: 'EUR' },
      {
        userId,
        type: 'GOLD',
        name: 'Sieraden',
        value: '8500.00',
        currency: 'EUR',
        weightGrams: '120.000',
        purityKarat: 21,
      },
      { userId, type: 'CRYPTO', name: 'Crypto-portefeuille', value: '3250.00', currency: 'EUR' },
    ],
  })

  await prisma.liability.createMany({
    data: [
      {
        userId,
        type: 'SHORT_TERM_DEBT',
        name: 'Lening familie',
        amount: '2500.00',
        currency: 'EUR',
        dueDate: new Date('2026-09-01T00:00:00Z'),
      },
      {
        userId,
        type: 'CREDIT_CARD',
        name: 'Kredietkaart',
        amount: '1000.00',
        currency: 'EUR',
      },
    ],
  })
}
