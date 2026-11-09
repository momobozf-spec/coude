import { describe, expect, it } from 'vitest'
import { FinancingType, ShariahAssessmentStatus } from '@prisma/client'

import {
  COMPARISON_DISCLAIMER,
  compareFinancingProducts,
  MAX_FINANCING_COMPARE,
  MIN_FINANCING_COMPARE,
  sortProducts,
  type ComparableProduct,
} from '@/modules/financing/domain/comparison'
import { calculateFinancing } from '@/modules/financing/domain/calculators'
import { FinancingError } from '@/modules/financing/domain/errors'
import {
  SYSTEM_COMPLETABLE_TASKS,
  NEVER_SYSTEM_COMPLETABLE,
  isSystemCompletable,
} from '@/modules/financing/journeyBridge'

const calculation = (type: FinancingType, rate: number | null) =>
  calculateFinancing(type, {
    purchasePrice: 450_000,
    ownContribution: 90_000,
    termMonths: 240,
    profitRateBasisPoints: rate,
  })

const product = (overrides: Partial<ComparableProduct> = {}): ComparableProduct => ({
  id: 'p1',
  name: 'Product',
  providerName: 'Aanbieder',
  providerId: 'prov1',
  financingType: FinancingType.MURABAHA,
  currency: 'EUR',
  isDemo: false,
  providerVerified: true,

  minOwnContributionPercentage: 20,
  termMinMonths: 120,
  termMaxMonths: 300,
  setupFeeAmount: 750,
  feesDescription: null,

  shariahAssessmentStatus: ShariahAssessmentStatus.REVIEWED,
  certificationBody: null,
  sourceUrl: 'https://example.com/product',
  lastVerifiedAt: new Date('2026-06-01'),

  calculation: calculation(FinancingType.MURABAHA, 400),
  ...overrides,
})

const rowFor = (comparison: ReturnType<typeof compareFinancingProducts>, key: string) =>
  comparison.rows.find((r) => r.key === key)

describe('grenzen', () => {
  it('weigert minder dan het minimum', () => {
    expect(() => compareFinancingProducts([product()])).toThrow(FinancingError)
  })

  it('weigert meer dan het maximum', () => {
    const many = Array.from({ length: MAX_FINANCING_COMPARE + 1 }, (_, i) =>
      product({ id: `p${i}` }),
    )
    expect(() => compareFinancingProducts(many)).toThrow(FinancingError)
  })

  it('accepteert het minimum en het maximum', () => {
    for (const count of [MIN_FINANCING_COMPARE, MAX_FINANCING_COMPARE]) {
      const products = Array.from({ length: count }, (_, i) => product({ id: `p${i}` }))
      expect(() => compareFinancingProducts(products)).not.toThrow()
    }
  })
})

describe('gunstigste waarde', () => {
  it('markeert de laagste periodieke betaling', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'goedkoop', calculation: calculation(FinancingType.MURABAHA, 300) }),
      product({ id: 'duur', calculation: calculation(FinancingType.MURABAHA, 500) }),
    ])

    const row = rowFor(comparison, 'periodicPayment')
    expect(row?.cells.find((c) => c.productId === 'goedkoop')?.best).toBe(true)
    expect(row?.cells.find((c) => c.productId === 'duur')?.best).toBe(false)
  })

  it('markeert de langste looptijd als gunstig', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'kort', termMaxMonths: 240 }),
      product({ id: 'lang', termMaxMonths: 360 }),
    ])
    expect(rowFor(comparison, 'termMax')?.cells.find((c) => c.productId === 'lang')?.best).toBe(
      true,
    )
  })

  it('markeert niemand bij gelijkspel', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', setupFeeAmount: 750 }),
      product({ id: 'b', setupFeeAmount: 750 }),
    ])
    expect(rowFor(comparison, 'fees')?.cells.every((c) => !c.best)).toBe(true)
  })

  it('markeert niets wanneer maar één product de waarde heeft', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', setupFeeAmount: 750 }),
      product({ id: 'b', setupFeeAmount: null }),
    ])
    expect(rowFor(comparison, 'fees')?.cells.every((c) => !c.best)).toBe(true)
  })
})

describe('ontbrekende waarden', () => {
  it('toont "Niet beschikbaar", nooit nul', () => {
    // Nul is een bewering; ontbrekend is de waarheid.
    const comparison = compareFinancingProducts([
      product({ id: 'a', setupFeeAmount: null }),
      product({ id: 'b', setupFeeAmount: 750 }),
    ])

    const cell = rowFor(comparison, 'fees')?.cells.find((c) => c.productId === 'a')
    expect(cell?.display).toBe('Niet beschikbaar')
    expect(cell?.display).not.toBe('€ 0')
    expect(cell?.value).toBeNull()
  })

  it('telt hoeveel producten een waarde missen', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', minOwnContributionPercentage: null }),
      product({ id: 'b', minOwnContributionPercentage: 20 }),
    ])
    expect(rowFor(comparison, 'ownContribution')?.unavailableCount).toBe(1)
  })

  it('houdt een product zonder berekening in de vergelijking', () => {
    // Wegfilteren zou verbergen dát het bestaat.
    const comparison = compareFinancingProducts([
      product({ id: 'a' }),
      product({ id: 'b', calculation: calculation(FinancingType.MURABAHA, null) }),
    ])

    expect(comparison.products).toHaveLength(2)
    expect(
      rowFor(comparison, 'periodicPayment')?.cells.find((c) => c.productId === 'b')?.display,
    ).toBe('Niet beschikbaar')
  })
})

describe('shariah-beoordeling wordt niet gerangschikt', () => {
  it('staat niet tussen de vergelijkbare rijen', () => {
    // Een certificering vergelijken als was het een rentevoet, is precies de
    // gelijkschakeling die dit platform vermijdt.
    const comparison = compareFinancingProducts([product({ id: 'a' }), product({ id: 'b' })])

    const rowKeys = comparison.rows.map((r) => r.key)
    expect(rowKeys).not.toContain('shariah')
    expect(rowKeys).not.toContain('assessment')
  })

  it('geeft per product de herkomst terug, zonder markering', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', shariahAssessmentStatus: ShariahAssessmentStatus.CERTIFIED }),
      product({ id: 'b', shariahAssessmentStatus: ShariahAssessmentStatus.UNKNOWN }),
    ])

    expect(comparison.assessments).toHaveLength(2)
    for (const assessment of comparison.assessments) {
      expect(assessment).not.toHaveProperty('best')
      expect(assessment).not.toHaveProperty('rank')
      expect(assessment.statement.length).toBeGreaterThan(0)
    }
  })

  it('geeft de actualiteit per beoordeling mee', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', lastVerifiedAt: null }),
      product({ id: 'b', lastVerifiedAt: new Date('2026-06-01') }),
    ])

    expect(comparison.assessments.find((a) => a.productId === 'a')?.freshness.state).toBe(
      'UNVERIFIED',
    )
  })
})

describe('geen beste optie', () => {
  it('wijst geen winnaar aan', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', calculation: calculation(FinancingType.MURABAHA, 300) }),
      product({ id: 'b', termMaxMonths: 360 }),
    ])

    expect(comparison).not.toHaveProperty('winner')
    expect(comparison).not.toHaveProperty('bestProductId')
    expect(comparison).not.toHaveProperty('recommended')
  })

  it('draagt een disclaimer over ontbrekende gegevens', () => {
    const comparison = compareFinancingProducts([product({ id: 'a' }), product({ id: 'b' })])

    expect(comparison.disclaimer).toBe(COMPARISON_DISCLAIMER)
    expect(comparison.disclaimer).toContain('niet dat ze nul is')
  })

  it('meldt wanneer er voorbeeldproducten in staan', () => {
    const comparison = compareFinancingProducts([
      product({ id: 'a', isDemo: false }),
      product({ id: 'b', isDemo: true }),
    ])
    expect(comparison.containsDemo).toBe(true)
  })
})

describe('sorteren', () => {
  it('zet voorbeeldproducten altijd achteraan', () => {
    const sorted = sortProducts(
      [
        product({ id: 'demo', providerName: 'Aaa', isDemo: true }),
        product({ id: 'echt', providerName: 'Zzz', isDemo: false }),
      ],
      'provider',
    )
    expect(sorted[0]?.id).toBe('echt')
  })

  it('sorteert op laagste betaling', () => {
    const sorted = sortProducts(
      [
        product({ id: 'duur', calculation: calculation(FinancingType.MURABAHA, 500) }),
        product({ id: 'goedkoop', calculation: calculation(FinancingType.MURABAHA, 300) }),
      ],
      'payment',
    )
    expect(sorted[0]?.id).toBe('goedkoop')
  })

  it('zet producten zonder berekening onderaan, niet als goedkoopste', () => {
    const sorted = sortProducts(
      [
        product({ id: 'onbekend', calculation: calculation(FinancingType.MURABAHA, null) }),
        product({ id: 'bekend' }),
      ],
      'payment',
    )
    expect(sorted[0]?.id).toBe('bekend')
  })

  it('sorteert op laagste eigen inbreng', () => {
    const sorted = sortProducts(
      [
        product({ id: 'hoog', minOwnContributionPercentage: 30 }),
        product({ id: 'laag', minOwnContributionPercentage: 10 }),
      ],
      'ownContribution',
    )
    expect(sorted[0]?.id).toBe('laag')
  })
})

describe('welke taken het systeem zelf mag afvinken', () => {
  it('vinkt alleen taken af met objectief bewijs', () => {
    expect(isSystemCompletable('FINANCING_COMPARE_OPTIONS')).toBe(true)
  })

  it('vinkt nooit een taak af die in het hoofd van de gebruiker gebeurt', () => {
    // "Begrijp je financiering" kan een systeem niet weten.
    for (const key of NEVER_SYSTEM_COMPLETABLE) {
      expect(isSystemCompletable(key), key).toBe(false)
    }
  })

  it('houdt de twee lijsten gescheiden', () => {
    const completable = SYSTEM_COMPLETABLE_TASKS.map((t) => t.templateKey)
    for (const key of NEVER_SYSTEM_COMPLETABLE) {
      expect(completable, key).not.toContain(key)
    }
  })

  it('vereist twee verschillende producten voordat vergelijken telt', () => {
    const rule = SYSTEM_COMPLETABLE_TASKS.find(
      (t) => t.templateKey === 'FINANCING_COMPARE_OPTIONS',
    )!

    const evidence = {
      quoteCount: 2,
      distinctProductsCompared: 1,
      hasShortlisted: false,
      comparedAtLeastTwo: false,
    }

    // Twee berekeningen voor hetzelfde product is geen vergelijking.
    expect(rule.isSatisfied(evidence)).toBe(false)
    expect(
      rule.isSatisfied({ ...evidence, distinctProductsCompared: 2, comparedAtLeastTwo: true }),
    ).toBe(true)
  })

  it('documenteert per taak waarom het bewijs objectief is', () => {
    for (const rule of SYSTEM_COMPLETABLE_TASKS) {
      expect(rule.evidence.length, rule.templateKey).toBeGreaterThan(20)
    }
  })
})
