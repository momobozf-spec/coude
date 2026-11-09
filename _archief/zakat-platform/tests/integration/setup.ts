import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'

/**
 * Integration-test harness (§31).
 *
 * These tests need a real PostgreSQL. They are skipped — loudly, never silently
 * deleted — when `TEST_DATABASE_URL` is absent, so the unit suite stays green on
 * a machine without a database while the integration suite remains ready:
 *
 *   TEST_DATABASE_URL=postgresql://… npm run test:integration
 *
 * The URL must point at a throwaway database: the harness truncates every table
 * between tests. It deliberately reuses the application's own Prisma singleton
 * (which `vitest.config.ts` points at `TEST_DATABASE_URL`) so services under
 * test and assertions share one connection and see the same transactions.
 */

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL)

export { prisma }

/**
 * Empty every table between tests. TRUNCATE … CASCADE is far faster than
 * deleting in dependency order and cannot be defeated by a foreign key added
 * later.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `

  if (tables.length === 0) return

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/**
 * Create a user with the rows every user is assumed to have, and return the
 * `Actor` the services take. Bypasses NextAuth on purpose — session handling is
 * not what these tests are about.
 */
export async function createTestUser(
  options: {
    email?: string
    plan?: Actor['plan']
    currency?: string
    nisabBasis?: 'GOLD' | 'SILVER' | 'CUSTOM'
    customNisabValue?: string
  } = {},
): Promise<Actor> {
  const email = options.email ?? `user-${Math.random().toString(36).slice(2)}@test.local`

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test User',
      onboardedAt: new Date(),
      subscription: { create: { plan: options.plan ?? 'FAMILY', status: 'ACTIVE' } },
      notificationPreference: { create: {} },
      zakatProfile: {
        create: {
          defaultCurrency: options.currency ?? 'EUR',
          nisabBasis: options.nisabBasis ?? 'SILVER',
          customNisabValue: options.customNisabValue,
          onboardingStep: 4,
        },
      },
    },
  })

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: 'USER',
    plan: options.plan ?? 'FAMILY',
    locale: 'nl',
    timezone: 'Europe/Brussels',
    defaultCurrency: options.currency ?? 'EUR',
    onboarded: true,
    households: [],
  }
}

/** The default ruleset, matching what `prisma/seed/rulesets.ts` writes. */
export async function createRuleSet(version = '2026.1-default') {
  return prisma.zakatRuleSet.create({
    data: {
      version,
      name: 'Standaardmethode',
      methodology: 'DEFAULT',
      zakatRate: '0.025',
      goldNisabGrams: '85',
      silverNisabGrams: '595',
      allowLiabilityDeduction: true,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      active: true,
      assetRules: {
        create: (
          [
            'CASH',
            'BANK_ACCOUNT',
            'SAVINGS',
            'GOLD',
            'SILVER',
            'INVESTMENTS',
            'CRYPTO',
            'BUSINESS_CASH',
            'BUSINESS_INVENTORY',
            'RECEIVABLES',
            'PROPERTY_INVESTMENT',
            'OTHER',
          ] as const
        ).map((assetType) => ({
          assetType,
          zakatable: true,
          defaultZakatablePercentage: '100',
          rationale: 'Telt volledig mee.',
        })),
      },
      liabilityRules: {
        create: [
          {
            liabilityType: 'SHORT_TERM_DEBT' as const,
            deductibleByDefault: true,
            maxMonthsAhead: 12,
            rationale: 'Aftrekbaar binnen twaalf maanden.',
          },
          {
            liabilityType: 'OTHER' as const,
            deductibleByDefault: false,
            maxMonthsAhead: null,
            rationale: 'Niet automatisch aftrekbaar.',
          },
        ],
      },
    },
  })
}
