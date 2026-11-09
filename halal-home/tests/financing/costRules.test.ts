import { describe, expect, it } from 'vitest'

import {
  applyCostRule,
  costRuleConfigurationSchema,
  estimateCosts,
  selectApplicableRule,
  type CostRuleRecord,
} from '@/modules/financing/domain/costRules'
import { BE_COST_RULES } from '../../prisma/seed-data/costRules'

const context = { purchasePrice: 400_000, financedAmount: 320_000, firstHome: false }

describe('regelconfiguraties', () => {
  it('past een vast percentage toe', () => {
    const amount = applyCostRule(
      'REGISTRATION_DUTY',
      { kind: 'FLAT_PERCENTAGE', basisPoints: 1200 },
      context,
    )
    expect(amount).toBe(48_000)
  })

  it('gebruikt het tarief voor een enige eigen woning wanneer dat geldt', () => {
    const configuration = {
      kind: 'FLAT_PERCENTAGE' as const,
      basisPoints: 1200,
      firstHomeBasisPoints: 200,
    }

    expect(applyCostRule('REGISTRATION_DUTY', configuration, context)).toBe(48_000)
    expect(
      applyCostRule('REGISTRATION_DUTY', configuration, { ...context, firstHome: true }),
    ).toBe(8_000)
  })

  it('past een aftrek op de grondslag toe, niet op het tarief', () => {
    // Zo werkt het Brusselse abattement: de grondslag daalt, niet het tarief.
    const amount = applyCostRule(
      'REGISTRATION_DUTY',
      {
        kind: 'FLAT_PERCENTAGE',
        basisPoints: 1250,
        firstHomeBasisPoints: 1250,
        firstHomeBaseDeduction: 200_000,
      },
      { ...context, firstHome: true },
    )
    expect(amount).toBe(Math.round((400_000 - 200_000) * 0.125))
  })

  it('laat een aftrek de grondslag nooit onder nul duwen', () => {
    const amount = applyCostRule(
      'REGISTRATION_DUTY',
      {
        kind: 'FLAT_PERCENTAGE',
        basisPoints: 1250,
        firstHomeBasisPoints: 1250,
        firstHomeBaseDeduction: 500_000,
      },
      { ...context, firstHome: true },
    )
    expect(amount).toBe(0)
  })

  it('rekent een schijventarief per schijf', () => {
    const amount = applyCostRule(
      'NOTARY_FEE',
      {
        kind: 'BRACKETED',
        brackets: [
          { upTo: 100_000, basisPoints: 100 },
          { upTo: null, basisPoints: 50 },
        ],
      },
      context,
    )
    // 1 % over de eerste 100.000 + 0,5 % over de resterende 300.000.
    expect(amount).toBe(1_000 + 1_500)
  })

  it('respecteert het minimumbedrag van een schijventarief', () => {
    const amount = applyCostRule(
      'NOTARY_FEE',
      {
        kind: 'BRACKETED',
        brackets: [{ upTo: null, basisPoints: 1 }],
        minimumAmount: 1_000,
      },
      { ...context, purchasePrice: 1_000 },
    )
    expect(amount).toBe(1_000)
  })

  it('geeft een vast bedrag ongewijzigd terug', () => {
    expect(applyCostRule('ADMINISTRATIVE_FEE', { kind: 'FIXED_AMOUNT', amount: 1_100 }, context)).toBe(
      1_100,
    )
  })

  it('rekent de hypothecaire inschrijving over het gefinancierde bedrag', () => {
    // Niet over de aankoopprijs: je schrijft in voor wat je leent.
    const amount = applyCostRule(
      'MORTGAGE_REGISTRATION',
      { kind: 'FLAT_PERCENTAGE', basisPoints: 100 },
      context,
    )
    expect(amount).toBe(3_200)
  })
})

const rule = (overrides: Partial<CostRuleRecord>): CostRuleRecord => ({
  id: 'r1',
  ruleType: 'REGISTRATION_DUTY',
  country: 'BE',
  region: null,
  validFrom: new Date('2020-01-01'),
  validUntil: null,
  configuration: { kind: 'FLAT_PERCENTAGE', basisPoints: 1000 },
  sourceUrl: null,
  lastVerifiedAt: null,
  notes: null,
  ...overrides,
})

describe('welke regel geldt', () => {
  const on = new Date('2026-08-07')

  it('kiest de regel die op dat moment geldig is', () => {
    const oud = rule({ id: 'oud', validFrom: new Date('2020-01-01'), validUntil: new Date('2024-01-01') })
    const nieuw = rule({ id: 'nieuw', validFrom: new Date('2024-01-01') })

    const selected = selectApplicableRule([oud, nieuw], {
      ruleType: 'REGISTRATION_DUTY',
      country: 'BE',
      region: null,
      on,
    })
    expect(selected?.id).toBe('nieuw')
  })

  it('laat een gewestelijke regel voorgaan op een landelijke', () => {
    const landelijk = rule({ id: 'landelijk', region: null })
    const gewest = rule({ id: 'gewest', region: 'FLANDERS' })

    const selected = selectApplicableRule([landelijk, gewest], {
      ruleType: 'REGISTRATION_DUTY',
      country: 'BE',
      region: 'FLANDERS',
      on,
    })
    expect(selected?.id).toBe('gewest')
  })

  it('geeft null wanneer er geen geldige regel is', () => {
    const verlopen = rule({ validUntil: new Date('2021-01-01') })
    expect(
      selectApplicableRule([verlopen], {
        ruleType: 'REGISTRATION_DUTY',
        country: 'BE',
        region: null,
        on,
      }),
    ).toBeNull()
  })

  it('negeert een regel van een ander gewest', () => {
    const brussel = rule({ region: 'BRUSSELS' })
    expect(
      selectApplicableRule([brussel], {
        ruleType: 'REGISTRATION_DUTY',
        country: 'BE',
        region: 'FLANDERS',
        on,
      }),
    ).toBeNull()
  })
})

describe('kostenraming', () => {
  const rules: CostRuleRecord[] = [
    rule({
      id: 'reg',
      ruleType: 'REGISTRATION_DUTY',
      region: 'FLANDERS',
      configuration: { kind: 'FLAT_PERCENTAGE', basisPoints: 1200, firstHomeBasisPoints: 200 },
    }),
    rule({
      id: 'adm',
      ruleType: 'ADMINISTRATIVE_FEE',
      configuration: { kind: 'FIXED_AMOUNT', amount: 1_100 },
    }),
  ]

  it('telt de posten op en rekent uit wat je zelf moet hebben', () => {
    const estimate = estimateCosts({
      rules,
      ruleTypes: ['REGISTRATION_DUTY', 'ADMINISTRATIVE_FEE'],
      purchasePrice: 400_000,
      ownContribution: 80_000,
      country: 'BE',
      region: 'FLANDERS',
      firstHome: true,
    })

    expect(estimate.totalCosts).toBe(8_000 + 1_100)
    expect(estimate.totalRequired).toBe(400_000 + 9_100)
    expect(estimate.ownFundsRequired).toBe(80_000 + 9_100)
  })

  it('rapporteert ontbrekende regels in plaats van ze stil op nul te zetten', () => {
    // Een raming die compleet lijkt maar de registratierechten mist, laat de
    // koper duizenden euro's te weinig opzijzetten. Beter zichtbaar ontbrekend.
    const estimate = estimateCosts({
      rules: [],
      ruleTypes: ['REGISTRATION_DUTY', 'NOTARY_FEE'],
      purchasePrice: 400_000,
      ownContribution: 80_000,
      country: 'BE',
      region: 'FLANDERS',
      firstHome: true,
    })

    expect(estimate.lines).toHaveLength(0)
    expect(estimate.missingRules).toEqual(['REGISTRATION_DUTY', 'NOTARY_FEE'])
  })

  it('behandelt een onleesbare configuratie als ontbrekend', () => {
    const kapot = rule({ ruleType: 'NOTARY_FEE', configuration: { kind: 'ONZIN' } })
    const estimate = estimateCosts({
      rules: [kapot],
      ruleTypes: ['NOTARY_FEE'],
      purchasePrice: 400_000,
      ownContribution: 80_000,
      country: 'BE',
      region: null,
      firstHome: false,
    })

    expect(estimate.missingRules).toEqual(['NOTARY_FEE'])
  })

  it('geeft de bron mee bij elke post', () => {
    const met = rule({ ruleType: 'ADMINISTRATIVE_FEE', sourceUrl: 'https://example.com' })
    const estimate = estimateCosts({
      rules: [met],
      ruleTypes: ['ADMINISTRATIVE_FEE'],
      purchasePrice: 400_000,
      ownContribution: 80_000,
      country: 'BE',
      region: null,
      firstHome: false,
    })
    expect(estimate.lines[0]?.sourceUrl).toBe('https://example.com')
  })
})

describe('de seed-kostenregels', () => {
  it('hebben allemaal een geldige configuratie', () => {
    for (const rule of BE_COST_RULES) {
      const parsed = costRuleConfigurationSchema.safeParse(rule.configuration)
      expect(parsed.success, `${rule.region ?? 'BE'} ${rule.ruleType}`).toBe(true)
    }
  })

  it('hebben allemaal een bron', () => {
    for (const rule of BE_COST_RULES) {
      expect(rule.sourceUrl, `${rule.region ?? 'BE'} ${rule.ruleType}`).toBeTruthy()
    }
  })

  it('zijn gemarkeerd als niet nagekeken', () => {
    // De seedwaarden zijn ontwikkelwaarden. Als iemand ze ooit verifieert, hoort
    // hij de notes aan te passen — en dan mag deze test mee wijzigen.
    for (const rule of BE_COST_RULES) {
      expect(rule.notes).toContain('ONTWIKKELWAARDE')
    }
  })
})
