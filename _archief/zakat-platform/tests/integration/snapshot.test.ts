import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasDatabase, createRuleSet, createTestUser, prisma, resetDatabase } from './setup'
import { FixtureMetalPriceProvider } from '@/server/integrations/metal-prices/fixture'
import {
  finalizeCalculation,
  getOrCreateDraft,
  readCalculation,
  recalculateDraft,
} from '@/server/modules/zakat/calculation-service'
import { createAsset, deleteAsset } from '@/server/modules/assets/service'
import { CalculationAlreadyFinalizedError } from '@/server/modules/zakat/errors'
import { NotFoundError } from '@/lib/errors'

/**
 * The immutable-snapshot guarantee (§16).
 *
 * This is the suite that proves the central promise of the product: once a
 * calculation is finalised, nothing that happens afterwards may change it —
 * not a moving gold price, not an edited asset, not a deleted asset, not a new
 * ruleset version.
 *
 * It needs a real database because the guarantee lives in what is *persisted*,
 * not in what the engine computes.
 */

const suite = hasDatabase ? describe : describe.skip

if (!hasDatabase) {
  console.warn(
    '\n[integration] TEST_DATABASE_URL is not set — the database suite is skipped.\n' +
      '              Run it with: TEST_DATABASE_URL=postgresql://… npm run test:integration\n',
  )
}

suite('finalised snapshots', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function setUpFinalized() {
    await createRuleSet()
    const actor = await createTestUser()

    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '35000.00',
      currency: 'EUR',
    })
    await createAsset(actor, {
      type: 'GOLD',
      name: 'Sieraden',
      weightGrams: '120',
      currency: 'EUR',
    })

    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    return { actor, finalized }
  }

  it('stores the price, rate and rule version it used', async () => {
    const { finalized } = await setUpFinalized()

    expect(finalized.status).toBe('FINALIZED')
    expect(finalized.finalizedAt).toBeTruthy()
    expect(finalized.rulesVersion).toBe('2026.1-default')
    expect(finalized.engineVersion).toBe('zakat-engine@1')
    expect(finalized.nisabPricePerGram).toBeTruthy()
    expect(finalized.nisabPriceSource).toBe('FIXTURE')
    expect(finalized.items.length).toBeGreaterThan(0)
  })

  it('does not change when the gold price moves', async () => {
    const { actor, finalized } = await setUpFinalized()
    const before = finalized.zakatDueMinor

    // The gold price doubles the day after finalising.
    vi.spyOn(FixtureMetalPriceProvider.prototype, 'getGoldPrice').mockResolvedValue({
      metal: 'GOLD',
      pricePerGram: '150.000000',
      currency: 'EUR',
      provider: 'fixture',
      sourceType: 'FIXTURE',
      observedAt: new Date('2026-08-08T00:00:00.000Z'),
    })

    const reread = await readCalculation(actor, finalized.id)
    expect(reread.zakatDueMinor).toBe(before)
    expect(reread.grossAssetsMinor).toBe(finalized.grossAssetsMinor)
    expect(reread.nisabPricePerGram).toBe(finalized.nisabPricePerGram)

    // And the mock really is in effect — a fresh calculation sees the new price.
    const fresh = await recalculateDraft(actor, null)
    expect(fresh.grossAssetsMinor).toBeGreaterThan(finalized.grossAssetsMinor)
  })

  it('does not change when the underlying asset is deleted', async () => {
    const { actor, finalized } = await setUpFinalized()

    const assets = await prisma.asset.findMany({ where: { userId: actor.userId } })
    for (const asset of assets) await deleteAsset(actor, asset.id)

    const reread = await readCalculation(actor, finalized.id)

    expect(reread.zakatDueMinor).toBe(finalized.zakatDueMinor)
    expect(reread.items).toHaveLength(finalized.items.length)
    // The line keeps its own label — it is not a join onto a row that is now gone.
    expect(reread.items.map((i) => i.label)).toContain('Spaargeld')
  })

  it('does not change when the asset is edited', async () => {
    const { actor, finalized } = await setUpFinalized()

    await prisma.asset.updateMany({
      where: { userId: actor.userId, type: 'SAVINGS' },
      data: { value: '1.00' },
    })

    const reread = await readCalculation(actor, finalized.id)
    expect(reread.grossAssetsMinor).toBe(finalized.grossAssetsMinor)
  })

  it('does not change when a new ruleset version becomes active', async () => {
    const { actor, finalized } = await setUpFinalized()

    await prisma.zakatRuleSet.updateMany({ data: { active: false } })
    const next = await createRuleSet('2027.1-default')
    await prisma.zakatRuleSet.update({
      where: { id: next.id },
      data: { zakatRate: '0.05', active: true },
    })

    const reread = await readCalculation(actor, finalized.id)

    expect(reread.rulesVersion).toBe('2026.1-default')
    expect(reread.zakatRate).toBe('0.025')
    expect(reread.zakatDueMinor).toBe(finalized.zakatDueMinor)
  })

  it('refuses to recalculate or re-finalise a finalised calculation', async () => {
    const { actor, finalized } = await setUpFinalized()

    // An ordinary PATCH must not be able to rewrite a snapshot (§26).
    await expect(recalculateDraft(actor, finalized.id)).rejects.toThrow(
      CalculationAlreadyFinalizedError,
    )
    await expect(finalizeCalculation(actor, finalized.id)).rejects.toThrow(
      CalculationAlreadyFinalizedError,
    )
  })

  it('leaves the draft untouched when finalisation cannot complete', async () => {
    await createRuleSet()
    const actor = await createTestUser()

    // No assets: finalisation must fail and the row must stay a usable draft.
    const draft = await getOrCreateDraft(actor)
    await expect(finalizeCalculation(actor, draft.id)).rejects.toThrow()

    const reread = await readCalculation(actor, draft.id)
    expect(reread.status).toBe('DRAFT')
    expect(reread.finalizedAt).toBeNull()
  })

  it('writes items and rates in the same transaction as the status change', async () => {
    const { actor, finalized } = await setUpFinalized()

    const [row, items] = await Promise.all([
      prisma.zakatCalculation.findUnique({ where: { id: finalized.id } }),
      prisma.zakatCalculationItem.findMany({ where: { calculationId: finalized.id } }),
    ])

    // A FINALIZED row with no items would mean the transaction did not hold.
    expect(row?.status).toBe('FINALIZED')
    expect(items.length).toBeGreaterThan(0)

    void actor
  })
})

suite('cross-user isolation against a real database', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('cannot read another user’s calculation', async () => {
    await createRuleSet()
    const owner = await createTestUser({ email: 'owner@test.local' })
    const stranger = await createTestUser({ email: 'stranger@test.local' })

    await createAsset(owner, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '10000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(owner)

    // 404, not 403 — confirming existence would leak that the id is real.
    await expect(readCalculation(stranger, draft.id)).rejects.toThrow(NotFoundError)
  })

  it('cannot finalise another user’s calculation', async () => {
    await createRuleSet()
    const owner = await createTestUser({ email: 'owner2@test.local' })
    const stranger = await createTestUser({ email: 'stranger2@test.local' })

    await createAsset(owner, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '10000.00',
      currency: 'EUR',
    })
    const draft = await getOrCreateDraft(owner)

    await expect(finalizeCalculation(stranger, draft.id)).rejects.toThrow(NotFoundError)
  })

  it('lists only the caller’s own calculations', async () => {
    await createRuleSet()
    const a = await createTestUser({ email: 'a@test.local' })
    const b = await createTestUser({ email: 'b@test.local' })

    await createAsset(a, { type: 'SAVINGS', name: 'A', value: '1000.00', currency: 'EUR' })
    await createAsset(b, { type: 'SAVINGS', name: 'B', value: '2000.00', currency: 'EUR' })

    await getOrCreateDraft(a)
    await getOrCreateDraft(b)

    const { listCalculations } = await import('@/server/modules/zakat/calculation-service')
    const forA = await listCalculations(a)

    expect(forA).toHaveLength(1)
    expect(forA[0]?.items.some((i) => i.label === 'B')).toBe(false)
  })
})
