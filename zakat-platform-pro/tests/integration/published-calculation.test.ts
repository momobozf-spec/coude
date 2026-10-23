import { afterAll, beforeEach, describe, expect, it } from 'vitest'

// Deze suite rekent met gepubliceerde prijzen, zoals productie. De omgeving
// wordt gezet vóór de eerste `serverEnv()`-aanroep; vitest isoleert modules
// per testbestand, dus andere suites blijven op fixture.
process.env.METAL_PRICE_PROVIDER = 'published'
process.env.FX_PROVIDER = 'published'
process.env.MAX_PRICE_AGE_DAYS = '4'

import { createRuleSet, createTestUser, hasDatabase, prisma, resetDatabase } from './setup'
import { createAsset } from '@/server/modules/assets/service'
import { finalizeCalculation, getOrCreateDraft } from '@/server/modules/zakat/calculation-service'
import { publishPrice } from '@/server/modules/prices/service'

const suite = hasDatabase ? describe : describe.skip

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

suite('berekenen met gepubliceerde prijzen', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function userWithSavings(currency = 'EUR') {
    await createRuleSet()
    const actor = await createTestUser({ currency, nisabBasis: 'SILVER' })
    await createAsset(actor, { type: 'SAVINGS', name: 'Spaargeld', value: '10000.00', currency })
    return actor
  }

  it('legt de gepubliceerde zilverprijs met bron en datum vast', async () => {
    await publishPrice(null, { kind: 'SILVER_PER_GRAM', currency: 'EUR', value: '1.10', effectiveDate: today(), source: 'Testbron zilver' })
    await publishPrice(null, { kind: 'GOLD_PER_GRAM', currency: 'EUR', value: '100.00', effectiveDate: today(), source: 'Testbron goud' })
    const actor = await userWithSavings()

    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    expect(finalized.nisabPriceSource).toBe('PUBLISHED')
    expect(Number(finalized.nisabPricePerGram)).toBeCloseTo(1.1, 6)
    // Nisab zilver volgens de regelset (595 g) × 1,10 EUR/g ligt ver onder 10 000.
    expect(finalized.aboveNisab).toBe(true)
  })

  it('weigert te rekenen met een te oude prijs', async () => {
    await publishPrice(null, { kind: 'SILVER_PER_GRAM', currency: 'EUR', value: '1.10', effectiveDate: daysAgo(10), source: 'Oude bron' })
    const actor = await userWithSavings()

    const draft = getOrCreateDraft(actor).then((row) => finalizeCalculation(actor, row.id))
    await expect(draft).rejects.toThrow(/10 dagen oud|prijs/)
  })

  it('rekent een andere valuta om met de gepubliceerde koers', async () => {
    await publishPrice(null, { kind: 'SILVER_PER_GRAM', currency: 'EUR', value: '1.00', effectiveDate: today(), source: 'Testbron zilver' })
    await publishPrice(null, { kind: 'FX_PER_EUR', currency: 'USD', value: '1.20', effectiveDate: today(), source: 'Testkoers' })
    const actor = await userWithSavings('USD')

    const draft = await getOrCreateDraft(actor)
    const finalized = await finalizeCalculation(actor, draft.id)

    expect(finalized.currency).toBe('USD')
    expect(Number(finalized.nisabPricePerGram)).toBeCloseTo(1.2, 6)
  })
})
