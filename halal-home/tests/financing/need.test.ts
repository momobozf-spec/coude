import { describe, expect, it } from 'vitest'

import { calculateFinancingNeed, describeNeed } from '@/modules/financing/domain/need'

describe('financieringsbehoefte', () => {
  it('rekent het verschil uit', () => {
    const need = calculateFinancingNeed({
      purchasePriceCents: 450_000_00,
      ownContributionCents: 90_000_00,
    })

    expect(need.neededCents).toBe(360_000_00)
    expect(need.fullyCovered).toBe(false)
    expect(need.ownContributionPercentage).toBe(20)
  })

  it('toont nooit een negatief bedrag', () => {
    // Iemand die zijn vorige woning verkocht, of die een bedrag in de verkeerde
    // eenheid intikt. Een negatief financieringsbedrag is een bug die eruitziet
    // als een belediging.
    const need = calculateFinancingNeed({
      purchasePriceCents: 300_000_00,
      ownContributionCents: 400_000_00,
    })

    expect(need.neededCents).toBe(0)
    expect(need.fullyCovered).toBe(true)
    expect(need.surplusCents).toBe(100_000_00)
  })

  it('herkent het exacte grensgeval', () => {
    const need = calculateFinancingNeed({
      purchasePriceCents: 300_000_00,
      ownContributionCents: 300_000_00,
    })

    expect(need.neededCents).toBe(0)
    expect(need.fullyCovered).toBe(true)
    expect(need.surplusCents).toBe(0)
  })

  it('kapt het percentage af op 100', () => {
    const need = calculateFinancingNeed({
      purchasePriceCents: 300_000_00,
      ownContributionCents: 900_000_00,
    })
    expect(need.ownContributionPercentage).toBe(100)
  })

  it('meldt welke gegevens ontbreken', () => {
    expect(
      calculateFinancingNeed({ purchasePriceCents: null, ownContributionCents: null }).missing,
    ).toEqual(['purchasePrice', 'ownContribution'])

    expect(
      calculateFinancingNeed({ purchasePriceCents: 450_000_00, ownContributionCents: null })
        .missing,
    ).toEqual(['ownContribution'])
  })

  it('geeft geen bedrag zonder complete invoer', () => {
    expect(
      calculateFinancingNeed({ purchasePriceCents: 450_000_00, ownContributionCents: null })
        .neededCents,
    ).toBeNull()
  })

  it('deelt niet door nul bij een aankoopprijs van nul', () => {
    const need = calculateFinancingNeed({ purchasePriceCents: 0, ownContributionCents: 0 })
    expect(need.ownContributionPercentage).toBeNull()
    expect(need.neededCents).toBe(0)
  })
})

describe('uitleg', () => {
  it('vraagt om de ontbrekende gegevens', () => {
    expect(
      describeNeed(
        calculateFinancingNeed({ purchasePriceCents: null, ownContributionCents: null }),
      ),
    ).toContain('aankoopbudget')

    expect(
      describeNeed(
        calculateFinancingNeed({ purchasePriceCents: 450_000_00, ownContributionCents: null }),
      ),
    ).toContain('eigen middelen')
  })

  it('legt uit dat er niets te financieren valt', () => {
    const text = describeNeed(
      calculateFinancingNeed({
        purchasePriceCents: 300_000_00,
        ownContributionCents: 400_000_00,
      }),
    )
    expect(text).toContain('geen financiering nodig')
    // Ook dan blijven de aankoopkosten een aandachtspunt.
    expect(text).toContain('aankoopkosten')
  })

  it('vermeldt dat aankoopkosten er niet in zitten', () => {
    const text = describeNeed(
      calculateFinancingNeed({
        purchasePriceCents: 450_000_00,
        ownContributionCents: 90_000_00,
      }),
    )
    expect(text).toContain('exclusief aankoopkosten')
  })
})
