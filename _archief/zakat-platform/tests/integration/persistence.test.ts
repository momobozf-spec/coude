import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createRuleSet, createTestUser, prisma, resetDatabase } from './setup'
import { createAsset, listAssets, updateAsset } from '@/server/modules/assets/service'
import { createLiability, listLiabilities } from '@/server/modules/liabilities/service'
import { getOrCreateDraft } from '@/server/modules/zakat/calculation-service'
import { saveOnboardingStep, updateZakatProfile } from '@/server/modules/zakat/profile-service'
import { NotFoundError } from '@/lib/errors'
import { EntitlementError } from '@/lib/errors'

/**
 * Schema and service behaviour against a real database (§31): migrations,
 * constraints, scoped queries and the audit trail.
 */

const suite = hasDatabase ? describe : describe.skip

suite('schema and migrations', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('has applied the migrations — every core table is queryable', async () => {
    await Promise.all([
      prisma.user.count(),
      prisma.zakatProfile.count(),
      prisma.asset.count(),
      prisma.liability.count(),
      prisma.zakatRuleSet.count(),
      prisma.zakatCalculation.count(),
      prisma.zakatCalculationItem.count(),
      prisma.zakatCalculationRate.count(),
      prisma.charity.count(),
      prisma.auditLog.count(),
    ])
  })

  it('carries the phase-2 columns', async () => {
    await createRuleSet()
    const actor = await createTestUser()

    const profile = await prisma.zakatProfile.findUniqueOrThrow({
      where: { userId: actor.userId },
    })

    expect(profile.onboardingStep).toBe(4)
    expect(Array.isArray(profile.relevantAssetTypes)).toBe(true)

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'S',
      value: '1000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(actor)

    expect(draft.engineVersion).toBe('zakat-engine@1')
    expect(draft.wizardStep).toBeGreaterThanOrEqual(1)
  })
})

suite('unique constraints', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects a duplicate email', async () => {
    await createTestUser({ email: 'dup@test.local' })
    await expect(createTestUser({ email: 'dup@test.local' })).rejects.toThrow()
  })

  it('rejects a second profile for the same user', async () => {
    const actor = await createTestUser()
    await expect(
      prisma.zakatProfile.create({ data: { userId: actor.userId } }),
    ).rejects.toThrow()
  })

  it('rejects a duplicate ruleset version', async () => {
    await createRuleSet('2026.1-default')
    await expect(createRuleSet('2026.1-default')).rejects.toThrow()
  })

  it('rejects the same charity favourited twice', async () => {
    const actor = await createTestUser()
    const charity = await prisma.charity.create({
      data: { slug: 'x', name: 'X', country: 'BE', website: 'https://example.org' },
    })

    await prisma.favoriteCharity.create({
      data: { userId: actor.userId, charityId: charity.id },
    })
    await expect(
      prisma.favoriteCharity.create({ data: { userId: actor.userId, charityId: charity.id } }),
    ).rejects.toThrow()
  })

  it('rejects a duplicate asset rule for one ruleset', async () => {
    const ruleSet = await createRuleSet()
    await expect(
      prisma.zakatAssetRule.create({
        data: { ruleSetId: ruleSet.id, assetType: 'SAVINGS', defaultZakatablePercentage: '50' },
      }),
    ).rejects.toThrow()
  })
})

suite('scoped queries', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('never returns another user’s assets', async () => {
    const a = await createTestUser({ email: 'sa@test.local' })
    const b = await createTestUser({ email: 'sb@test.local' })

    await createAsset(a, { type: 'SAVINGS', name: 'Van A', value: '100.00', currency: 'EUR' })
    await createAsset(b, { type: 'SAVINGS', name: 'Van B', value: '200.00', currency: 'EUR' })

    const forA = await listAssets(a)
    expect(forA).toHaveLength(1)
    expect(forA[0]?.name).toBe('Van A')
  })

  it('refuses a write to another user’s asset', async () => {
    const a = await createTestUser({ email: 'wa@test.local' })
    const b = await createTestUser({ email: 'wb@test.local' })

    const asset = await createAsset(b, {
      type: 'SAVINGS',
      name: 'Van B',
      value: '200.00',
      currency: 'EUR',
    })

    await expect(
      updateAsset(a, asset.id, {
        type: 'SAVINGS',
        name: 'Gekaapt',
        value: '1.00',
        currency: 'EUR',
      }),
    ).rejects.toThrow(NotFoundError)

    const unchanged = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(unchanged.name).toBe('Van B')
  })

  it('gives a household member read access but not write access', async () => {
    const owner = await createTestUser({ email: 'ho@test.local' })
    const member = await createTestUser({ email: 'hm@test.local' })

    const household = await prisma.household.create({
      data: {
        name: 'Familie',
        ownerUserId: owner.userId,
        members: {
          create: [
            { userId: owner.userId, role: 'OWNER', sharesFinancials: true },
            { userId: member.userId, role: 'MEMBER', sharesFinancials: true },
          ],
        },
      },
    })

    const ownerWithHousehold = {
      ...owner,
      households: [{ householdId: household.id, role: 'OWNER' as const, sharesFinancials: true }],
    }
    const memberWithHousehold = {
      ...member,
      households: [{ householdId: household.id, role: 'MEMBER' as const, sharesFinancials: true }],
    }

    const shared = await createAsset(ownerWithHousehold, {
      type: 'SAVINGS',
      name: 'Gedeeld spaargeld',
      value: '5000.00',
      currency: 'EUR',
      householdId: household.id,
    })

    // Visible…
    const visible = await listAssets(memberWithHousehold)
    expect(visible.map((a) => a.name)).toContain('Gedeeld spaargeld')
    expect(visible.find((a) => a.id === shared.id)?.editable).toBe(false)

    // …but not writable. Joining a household does not transfer ownership (§40).
    await expect(
      updateAsset(memberWithHousehold, shared.id, {
        type: 'SAVINGS',
        name: 'Overgenomen',
        value: '1.00',
        currency: 'EUR',
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('keeps a household member’s assets out of someone else’s calculation', async () => {
    await createRuleSet()

    const owner = await createTestUser({ email: 'co@test.local' })
    const member = await createTestUser({ email: 'cm@test.local' })

    const household = await prisma.household.create({
      data: {
        name: 'Familie',
        ownerUserId: owner.userId,
        members: {
          create: [
            { userId: owner.userId, role: 'OWNER', sharesFinancials: true },
            { userId: member.userId, role: 'MEMBER', sharesFinancials: true },
          ],
        },
      },
    })

    const ownerWithHousehold = {
      ...owner,
      households: [{ householdId: household.id, role: 'OWNER' as const, sharesFinancials: true }],
    }
    const memberWithHousehold = {
      ...member,
      households: [{ householdId: household.id, role: 'MEMBER' as const, sharesFinancials: true }],
    }

    await createAsset(ownerWithHousehold, {
      type: 'SAVINGS',
      name: 'Van de eigenaar',
      value: '50000.00',
      currency: 'EUR',
      householdId: household.id,
    })
    await createAsset(memberWithHousehold, {
      type: 'SAVINGS',
      name: 'Van het lid',
      value: '1000.00',
      currency: 'EUR',
    })

    const draft = await getOrCreateDraft(memberWithHousehold)

    // Someone else's wealth is visible on a shared dashboard but is not part of
    // this person's Zakat obligation.
    expect(draft.items.map((i) => i.label)).toEqual(['Van het lid'])
    expect(draft.grossAssetsMinor).toBe(100_000)
  })
})

suite('entitlements against real counts', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('stops a free user at the asset limit', async () => {
    const actor = await createTestUser({ email: 'free@test.local', plan: 'FREE' })

    for (let i = 0; i < 10; i += 1) {
      await createAsset(actor, {
        type: 'SAVINGS',
        name: `Post ${i}`,
        value: '100.00',
        currency: 'EUR',
      })
    }

    await expect(
      createAsset(actor, { type: 'SAVINGS', name: 'Elf', value: '100.00', currency: 'EUR' }),
    ).rejects.toThrow(EntitlementError)
  })

  it('blocks an advanced category on the free plan', async () => {
    const actor = await createTestUser({ email: 'free2@test.local', plan: 'FREE' })

    await expect(
      createAsset(actor, { type: 'CRYPTO', name: 'BTC', value: '100.00', currency: 'EUR' }),
    ).rejects.toThrow(EntitlementError)
  })

  it('blocks a second currency on the free plan', async () => {
    const actor = await createTestUser({ email: 'free3@test.local', plan: 'FREE' })

    await expect(
      createAsset(actor, { type: 'SAVINGS', name: 'USD', value: '100.00', currency: 'USD' }),
    ).rejects.toThrow(EntitlementError)
  })
})

suite('profile, onboarding and audit', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('resumes onboarding from where it stopped', async () => {
    const actor = await createTestUser({ email: 'onb@test.local' })
    await prisma.zakatProfile.update({
      where: { userId: actor.userId },
      data: { onboardingStep: 0 },
    })

    await saveOnboardingStep(actor, { step: 1, defaultCurrency: 'EUR' })
    await saveOnboardingStep(actor, { step: 2, nisabBasis: 'GOLD' })

    const halfway = await prisma.zakatProfile.findUniqueOrThrow({
      where: { userId: actor.userId },
    })
    expect(halfway.onboardingStep).toBe(2)
    expect(halfway.nisabBasis).toBe('GOLD')

    // Revisiting an earlier step must not make finished onboarding look unfinished.
    await saveOnboardingStep(actor, { step: 1, defaultCurrency: 'EUR' })
    const after = await prisma.zakatProfile.findUniqueOrThrow({
      where: { userId: actor.userId },
    })
    expect(after.onboardingStep).toBe(2)
  })

  it('marks the user onboarded on the final step', async () => {
    const actor = await createTestUser({ email: 'onb2@test.local' })
    await prisma.zakatProfile.update({
      where: { userId: actor.userId },
      data: { onboardingStep: 3 },
    })
    await prisma.user.update({ where: { id: actor.userId }, data: { onboardedAt: null } })

    await saveOnboardingStep(actor, { step: 4, relevantAssetTypes: ['SAVINGS', 'GOLD'] })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(user.onboardedAt).toBeTruthy()
  })

  it('audits financial changes without recording amounts', async () => {
    const actor = await createTestUser({ email: 'aud@test.local' })

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Geheim spaargeld',
      value: '123456.78',
      currency: 'EUR',
    })

    const entries = await prisma.auditLog.findMany({ where: { userId: actor.userId } })
    expect(entries.map((e) => e.action)).toContain('ASSET_CREATED')

    const serialized = JSON.stringify(entries)
    // Neither the amount nor the user's own label may appear in the trail (§28).
    expect(serialized).not.toContain('123456.78')
    expect(serialized).not.toContain('Geheim spaargeld')
  })

  it('records a profile update', async () => {
    const actor = await createTestUser({ email: 'prof@test.local' })
    await updateZakatProfile(actor, { nisabBasis: 'GOLD', deductShortTermDebts: false })

    const entries = await prisma.auditLog.findMany({ where: { userId: actor.userId } })
    expect(entries.map((e) => e.action)).toContain('ZAKAT_PROFILE_UPDATED')
  })

  it('creates liabilities that are visible to their owner only', async () => {
    const a = await createTestUser({ email: 'la@test.local' })
    const b = await createTestUser({ email: 'lb@test.local' })

    await createLiability(a, {
      type: 'SHORT_TERM_DEBT',
      name: 'Van A',
      amount: '500.00',
      currency: 'EUR',
    })

    expect(await listLiabilities(b)).toHaveLength(0)
    expect(await listLiabilities(a)).toHaveLength(1)
  })
})

suite('seed', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('is idempotent — running it twice leaves the same database', async () => {
    const { seedRuleSets } = await import('../../prisma/seed/rulesets')
    const { seedCharities } = await import('../../prisma/seed/charities')
    const { seedKnowledge } = await import('../../prisma/seed/knowledge')

    await seedRuleSets(prisma)
    await seedCharities(prisma)
    await seedKnowledge(prisma)

    const first = await Promise.all([
      prisma.zakatRuleSet.count(),
      prisma.charity.count(),
      prisma.cause.count(),
      prisma.charitySource.count(),
      prisma.knowledgeArticle.count(),
    ])

    await seedRuleSets(prisma)
    await seedCharities(prisma)
    await seedKnowledge(prisma)

    const second = await Promise.all([
      prisma.zakatRuleSet.count(),
      prisma.charity.count(),
      prisma.cause.count(),
      prisma.charitySource.count(),
      prisma.knowledgeArticle.count(),
    ])

    expect(second).toEqual(first)
  })

  it('produces a ruleset the engine can actually load', async () => {
    const { seedRuleSets } = await import('../../prisma/seed/rulesets')
    await seedRuleSets(prisma)

    const { loadActiveRuleSet } = await import('@/server/modules/zakat/rules/ruleset-loader')
    const ruleSet = await loadActiveRuleSet()

    expect(ruleSet.version).toBe('2026.1-default')
    expect(ruleSet.zakatRate).toBe('0.025')
    expect(ruleSet.assetRules.size).toBeGreaterThanOrEqual(12)
    expect(ruleSet.liabilityRules.size).toBeGreaterThanOrEqual(6)
  })
})
