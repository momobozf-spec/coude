/**
 * Financiering tegen een echte database.
 *
 * Wat hier bewezen wordt en in unit tests niet kan: dat een quote werkelijk een
 * onveranderlijk snapshot is, dat de propertyId-relatie klopt, en dat gebruiker
 * A niets van B kan lezen of wijzigen.
 *
 * Draaien: TEST_DATABASE_URL=postgresql://… npm run test:integration
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { FinancingQuoteStatus, FinancingType, ShariahAssessmentStatus } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma, uniqueEmail } from './helpers'
import { createJourneyWithBlueprint } from '@/modules/journey/service'
import { saveQuote, getFinancingEvidence } from '@/modules/financing/service'
import { syncFinancingTasks } from '@/modules/financing/journeyBridge'
import * as repository from '@/modules/financing/repository'

/** Maakt een geïsoleerd testproduct met eigen aanbieder. */
async function createTestProduct(options: { rate?: number | null; isDemo?: boolean } = {}) {
  const suffix = uniqueEmail('prod').split('@')[0]!

  const provider = await prisma.financingProvider.create({
    data: {
      slug: `test-provider-${suffix}`,
      name: `Testaanbieder ${suffix}`,
      country: 'BE',
      verified: false,
      isDemo: options.isDemo ?? true,
    },
  })

  const product = await prisma.financingProduct.create({
    data: {
      slug: `test-product-${suffix}`,
      providerId: provider.id,
      name: `Testproduct ${suffix}`,
      financingType: FinancingType.MURABAHA,
      country: 'BE',
      description: 'Testproduct',
      profitRateBasisPoints: options.rate === undefined ? 400 : options.rate,
      setupFeeAmount: 500,
      shariahAssessmentStatus: ShariahAssessmentStatus.REVIEWED,
      sourceUrl: 'https://example.com/test',
      lastVerifiedAt: new Date('2026-01-01'),
      isDemo: options.isDemo ?? true,
      currency: 'EUR',
    },
  })

  return { provider, product }
}

describeIfDatabase('quotes bewaren', () => {
  let userId: string
  let journeyId: string
  let productId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    journeyId = (await createJourneyWithBlueprint(userId, { name: 'Financieringstraject' })).id
    productId = (await createTestProduct()).product.id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.financingProduct.deleteMany({ where: { id: productId } })
    await prisma.$disconnect()
  })

  it('bewaart de berekening met alle snapshotvelden', async () => {
    const quote = await saveQuote(userId, {
      productId,
      purchasePriceCents: 450_000_00,
      ownContributionCents: 90_000_00,
      termMonths: 240,
      journeyId,
    })

    expect(quote.amountFinanced).toBe(360_000)
    expect(quote.monthlyPaymentCents).toBeGreaterThan(0)

    // Alles wat nodig is om de berekening te begrijpen staat ín de rij.
    expect(quote.providerName).toBeTruthy()
    expect(quote.productName).toBeTruthy()
    expect(quote.financingType).toBe(FinancingType.MURABAHA)
    expect(quote.profitRateBasisPoints).toBe(400)
    expect(quote.shariahAssessmentStatus).toBe(ShariahAssessmentStatus.REVIEWED)
    expect(quote.sourceUrl).toBe('https://example.com/test')
    expect(quote.calculatorVersion).toBe('financing-engine@1')
    expect(quote.productWasDemo).toBe(true)
  })

  it('bewaart de aannames', async () => {
    const quote = await prisma.financingQuote.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    expect(Array.isArray(quote.assumptions)).toBe(true)
    expect((quote.assumptions as unknown[]).length).toBeGreaterThan(3)
  })

  it('laat een oude quote onveranderd wanneer het product wijzigt', async () => {
    // Dit is §18: een quote van 7 augustus mag later niet stilletjes veranderen.
    const before = await prisma.financingQuote.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    await prisma.financingProduct.update({
      where: { id: productId },
      data: {
        profitRateBasisPoints: 900,
        name: 'Product met nieuwe naam',
        setupFeeAmount: 5000,
        shariahAssessmentStatus: ShariahAssessmentStatus.UNKNOWN,
      },
    })

    const after = await prisma.financingQuote.findUniqueOrThrow({ where: { id: before.id } })

    expect(after.profitRateBasisPoints).toBe(before.profitRateBasisPoints)
    expect(after.productName).toBe(before.productName)
    expect(after.monthlyPaymentCents).toBe(before.monthlyPaymentCents)
    expect(after.shariahAssessmentStatus).toBe(before.shariahAssessmentStatus)
  })

  it('blijft leesbaar wanneer het product verwijderd wordt', async () => {
    const { product } = await createTestProduct()
    const quote = await saveQuote(userId, {
      productId: product.id,
      purchasePriceCents: 300_000_00,
      ownContributionCents: 60_000_00,
      termMonths: 240,
      journeyId,
    })

    await prisma.financingProduct.delete({ where: { id: product.id } })

    const after = await prisma.financingQuote.findUniqueOrThrow({ where: { id: quote.id } })
    expect(after.productId).toBeNull()
    // De snapshot blijft: de berekening is nog steeds te begrijpen.
    expect(after.productName).toBeTruthy()
    expect(after.monthlyPaymentCents).toBeGreaterThan(0)
  })

  it('weigert te bewaren wanneer de berekening niet beschikbaar is', async () => {
    const { product } = await createTestProduct({ rate: null })

    await expect(
      saveQuote(userId, {
        productId: product.id,
        purchasePriceCents: 300_000_00,
        ownContributionCents: 60_000_00,
        termMonths: 240,
      }),
    ).rejects.toThrow()

    await prisma.financingProduct.deleteMany({ where: { id: product.id } })
  })
})

describeIfDatabase('quote gekoppeld aan een woning', () => {
  let userId: string
  let propertyId: string
  let productId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    productId = (await createTestProduct()).product.id

    const suffix = uniqueEmail('prop').split('@')[0]!
    const property = await prisma.property.create({
      data: {
        source: 'test',
        externalId: suffix,
        url: `https://example.com/${suffix}`,
        urlNormalized: `https://example.com/${suffix}`,
        fingerprint: suffix,
        title: 'Testwoning',
        price: 400_000,
      },
    })
    propertyId = property.id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.property.deleteMany({ where: { id: propertyId } })
    await prisma.financingProduct.deleteMany({ where: { id: productId } })
  })

  it('legt de relatie met de woning vast', async () => {
    const quote = await saveQuote(userId, {
      productId,
      propertyId,
      purchasePriceCents: 400_000_00,
      ownContributionCents: 80_000_00,
      termMonths: 240,
    })

    expect(quote.propertyId).toBe(propertyId)

    const found = await repository.listQuotes(userId, { propertyId })
    expect(found).toHaveLength(1)
    expect(found[0]?.property?.title).toBe('Testwoning')
  })

  it('laat de quote staan wanneer de woning verdwijnt', async () => {
    const quote = await prisma.financingQuote.findFirstOrThrow({ where: { userId } })
    await prisma.property.delete({ where: { id: propertyId } })

    const after = await prisma.financingQuote.findUniqueOrThrow({ where: { id: quote.id } })
    expect(after.propertyId).toBeNull()
    expect(after.monthlyPaymentCents).toBeGreaterThan(0)

    // Opnieuw aanmaken zodat afterAll niets breekt.
    const recreated = await prisma.property.create({
      data: {
        source: 'test',
        externalId: `${propertyId}-again`,
        url: `https://example.com/${propertyId}-again`,
        urlNormalized: `https://example.com/${propertyId}-again`,
        fingerprint: `${propertyId}-again`,
        title: 'Testwoning',
      },
    })
    propertyId = recreated.id
  })
})

describeIfDatabase('journey-integratie', () => {
  let userId: string
  let journeyId: string
  let firstProductId: string
  let secondProductId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    journeyId = (await createJourneyWithBlueprint(userId, { name: 'Bewijstraject' })).id
    firstProductId = (await createTestProduct()).product.id
    secondProductId = (await createTestProduct()).product.id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.financingProduct.deleteMany({
      where: { id: { in: [firstProductId, secondProductId] } },
    })
  })

  it('telt één product nog niet als vergelijking', async () => {
    await saveQuote(userId, {
      productId: firstProductId,
      purchasePriceCents: 450_000_00,
      ownContributionCents: 90_000_00,
      termMonths: 240,
      journeyId,
    })

    const evidence = await getFinancingEvidence(userId, journeyId)
    expect(evidence.distinctProductsCompared).toBe(1)
    expect(evidence.comparedAtLeastTwo).toBe(false)

    const result = await syncFinancingTasks(userId, journeyId)
    expect(result.completedTaskKeys).not.toContain('FINANCING_COMPARE_OPTIONS')
  })

  it('vinkt de vergelijkingstaak af bij twee verschillende producten', async () => {
    await saveQuote(userId, {
      productId: secondProductId,
      purchasePriceCents: 450_000_00,
      ownContributionCents: 90_000_00,
      termMonths: 240,
      journeyId,
    })

    const evidence = await getFinancingEvidence(userId, journeyId)
    expect(evidence.comparedAtLeastTwo).toBe(true)

    await syncFinancingTasks(userId, journeyId)

    const task = await prisma.journeyTask.findFirstOrThrow({
      where: { journeyId, templateKey: 'FINANCING_COMPARE_OPTIONS' },
    })
    expect(task.status).toBe('COMPLETED')
  })

  it('raakt taken die de gebruiker overgeslagen heeft niet aan', async () => {
    const task = await prisma.journeyTask.findFirstOrThrow({
      where: { journeyId, templateKey: 'FINANCING_COMPARE_OPTIONS' },
    })
    await prisma.journeyTask.update({ where: { id: task.id }, data: { status: 'SKIPPED' } })

    await syncFinancingTasks(userId, journeyId)

    const after = await prisma.journeyTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(after.status).toBe('SKIPPED')
  })
})

describeIfDatabase('user isolation op quotes', () => {
  let alice: string
  let bob: string
  let aliceQuoteId: string
  let productId: string

  beforeAll(async () => {
    alice = (await createUser('Alice')).id
    bob = (await createUser('Bob')).id
    productId = (await createTestProduct()).product.id

    const quote = await saveQuote(alice, {
      productId,
      purchasePriceCents: 450_000_00,
      ownContributionCents: 90_000_00,
      termMonths: 240,
    })
    aliceQuoteId = quote.id
  })

  afterAll(async () => {
    await deleteUser(alice)
    await deleteUser(bob)
    await prisma.financingProduct.deleteMany({ where: { id: productId } })
  })

  it('Bob kan de quote van Alice niet lezen', async () => {
    expect(await repository.findQuote(bob, aliceQuoteId)).toBeNull()
    await expect(repository.requireQuote(bob, aliceQuoteId)).rejects.toThrow()
  })

  it('Bob kan de quote van Alice niet wijzigen', async () => {
    await expect(
      repository.updateQuoteMeta(bob, aliceQuoteId, {
        status: FinancingQuoteStatus.REJECTED,
      }),
    ).rejects.toThrow()

    const after = await prisma.financingQuote.findUniqueOrThrow({ where: { id: aliceQuoteId } })
    expect(after.status).not.toBe(FinancingQuoteStatus.REJECTED)
  })

  it('Bob kan de quote van Alice niet verwijderen', async () => {
    await expect(repository.deleteQuote(bob, aliceQuoteId)).rejects.toThrow()

    expect(
      await prisma.financingQuote.count({ where: { id: aliceQuoteId } }),
    ).toBe(1)
  })

  it('Bob ziet de quote van Alice niet in zijn lijst', async () => {
    const quotes = await repository.listQuotes(bob)
    expect(quotes.map((q) => q.id)).not.toContain(aliceQuoteId)
  })

  it('Alice kan geen quote koppelen aan het traject van Bob', async () => {
    const bobJourney = await createJourneyWithBlueprint(bob, { name: 'Bob traject' })

    await expect(
      saveQuote(alice, {
        productId,
        purchasePriceCents: 450_000_00,
        ownContributionCents: 90_000_00,
        termMonths: 240,
        journeyId: bobJourney.id,
      }),
    ).rejects.toThrow()
  })
})
