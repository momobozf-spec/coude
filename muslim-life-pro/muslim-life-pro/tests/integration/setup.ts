import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Integration-test harness.
 *
 * These tests need a real PostgreSQL database and are skipped — loudly — when
 * `TEST_DATABASE_URL` is absent, so an incomplete environment reports itself
 * instead of quietly passing zero assertions.
 *
 * To run them:
 *   createdb muslimlife_test
 *   TEST_DATABASE_URL="postgresql://…/muslimlife_test" npm run db:test:push
 *   TEST_DATABASE_URL="postgresql://…/muslimlife_test" npm run test:integration
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

export const hasTestDatabase = Boolean(TEST_DATABASE_URL)

let client: PrismaClient | null = null

export function testPrisma(): PrismaClient {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is not set — this suite should have been skipped.')
  }

  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL, max: 3 }),
    log: ['error'],
  })

  return client
}

export async function disconnect() {
  await client?.$disconnect()
  client = null
}

/** A minimal user with the rows every actor is guaranteed to have. */
export async function createTestUser(email: string, plan: 'FREE' | 'PREMIUM' = 'FREE') {
  const prisma = testPrisma()

  return prisma.user.create({
    data: {
      email,
      name: `Test ${email}`,
      onboardedAt: new Date(),
      timezone: 'Europe/Brussels',
      subscription: { create: { plan, status: 'ACTIVE' } },
      preference: { create: {} },
    },
    select: { id: true, email: true },
  })
}

/** Actor shape matching `src/server/auth/actor.ts`, without touching Auth.js. */
export function actorFor(
  userId: string,
  email: string,
  plan: 'FREE' | 'PREMIUM' = 'FREE',
) {
  return {
    userId,
    email,
    name: 'Test User',
    role: 'USER' as const,
    plan,
    locale: 'en',
    timezone: 'Europe/Brussels',
    onboarded: true,
  }
}

/**
 * Remove everything a test created. Cascades handle owned rows, so deleting the
 * users is enough.
 */
export async function cleanup(userIds: string[]) {
  if (userIds.length === 0) return
  const prisma = testPrisma()
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}
