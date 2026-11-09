import { describe, expect, it } from 'vitest'
import { FinancingType } from '@prisma/client'

import {
  calculateFinancing,
  calculatorFor,
  isCalculationSupported,
  supportedFinancingTypes,
} from '@/modules/financing/domain/calculators'
import {
  FinancingInputError,
  FINANCING_CALCULATOR_VERSION,
  type FinancingInput,
} from '@/modules/financing/domain/calculators/types'
import { DiminishingMusharakaCalculator } from '@/modules/financing/domain/calculators/diminishingMusharaka'

const base: FinancingInput = {
  purchasePrice: 450_000,
  ownContribution: 90_000,
  termMonths: 240,
  profitRateBasisPoints: 400,
}

const expectAvailable = (result: ReturnType<typeof calculateFinancing>) => {
  if (!result.available) throw new Error(`Verwachtte een berekening, kreeg: ${result.reason}`)
  return result
}

describe('het register', () => {
  it('vindt een calculator voor de constructies die we ondersteunen', () => {
    for (const type of [
      FinancingType.MURABAHA,
      FinancingType.IJARA,
      FinancingType.DIMINISHING_MUSHARAKA,
      FinancingType.QARD_HASAN,
      FinancingType.CONVENTIONAL_MORTGAGE,
    ]) {
      expect(calculatorFor(type), type).not.toBeNull()
    }
  })

  it('kent geen calculator voor constructies die we niet modelleren', () => {
    // Correctheid gaat voor dekking: liever geen bedrag dan een verkeerd bedrag.
    expect(isCalculationSupported(FinancingType.ISTISNA)).toBe(false)
    expect(isCalculationSupported(FinancingType.OTHER)).toBe(false)
  })

  it('geeft voor een onbekende constructie een reden in plaats van een fout', () => {
    const result = calculateFinancing(FinancingType.ISTISNA, base)

    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.reason).toContain('geen rekenmodel')
    }
  })

  it('somt de ondersteunde constructies op', () => {
    expect(supportedFinancingTypes()).toContain(FinancingType.MURABAHA)
    expect(supportedFinancingTypes()).not.toContain(FinancingType.ISTISNA)
  })
})

describe('invoervalidatie geldt voor elke constructie', () => {
  const types = [
    FinancingType.MURABAHA,
    FinancingType.IJARA,
    FinancingType.DIMINISHING_MUSHARAKA,
    FinancingType.CONVENTIONAL_MORTGAGE,
  ]

  it('weigert een eigen inbreng die de hele prijs dekt', () => {
    for (const type of types) {
      expect(() =>
        calculateFinancing(type, { ...base, ownContribution: base.purchasePrice }),
      ).toThrow(FinancingInputError)
    }
  })

  it('weigert een negatieve eigen inbreng', () => {
    for (const type of types) {
      expect(() => calculateFinancing(type, { ...base, ownContribution: -1 })).toThrow(
        FinancingInputError,
      )
    }
  })

  it('weigert een looptijd buiten het bereik', () => {
    expect(() => calculateFinancing(FinancingType.MURABAHA, { ...base, termMonths: 0 })).toThrow(
      FinancingInputError,
    )
    expect(() =>
      calculateFinancing(FinancingType.MURABAHA, { ...base, termMonths: 600 }),
    ).toThrow(FinancingInputError)
  })

  it('weigert een onwaarschijnlijk hoog tarief', () => {
    expect(() =>
      calculateFinancing(FinancingType.MURABAHA, { ...base, profitRateBasisPoints: 5000 }),
    ).toThrow(FinancingInputError)
  })

  it('geeft een stabiele foutcode mee', () => {
    try {
      calculateFinancing(FinancingType.MURABAHA, { ...base, ownContribution: -1 })
      expect.unreachable('had moeten gooien')
    } catch (error) {
      expect((error as FinancingInputError).code).toBe('INVALID_OWN_CONTRIBUTION')
    }
  })
})

describe('ontbrekende productgegevens', () => {
  it('geeft geen bedrag zonder gepubliceerd tarief', () => {
    // Dit is de kern van §12/§13: geen nepformule zodat er toch iets staat.
    for (const type of [
      FinancingType.MURABAHA,
      FinancingType.IJARA,
      FinancingType.DIMINISHING_MUSHARAKA,
      FinancingType.CONVENTIONAL_MORTGAGE,
    ]) {
      const result = calculateFinancing(type, { ...base, profitRateBasisPoints: null })

      expect(result.available, type).toBe(false)
      if (!result.available) {
        expect(result.missingFields).toContain('profitRateBasisPoints')
        expect(result.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('rekent qard hasan wél door zonder tarief', () => {
    // Een renteloze lening heeft per definitie geen tarief nodig.
    const result = calculateFinancing(FinancingType.QARD_HASAN, {
      ...base,
      profitRateBasisPoints: null,
    })
    expect(result.available).toBe(true)
  })
})

describe('murabaha', () => {
  const result = expectAvailable(calculateFinancing(FinancingType.MURABAHA, base))

  it('financiert het verschil tussen prijs en eigen inbreng', () => {
    expect(result.amountFinancedCents).toBe(360_000 * 100)
  })

  it('benoemt de betaling als termijn, niet als rente', () => {
    expect(result.paymentLabel.toLowerCase()).toContain('termijn')
    const labels = result.breakdown.map((line) => line.label.toLowerCase()).join(' ')
    expect(labels).toContain('opslag')
    expect(labels).not.toContain('rente')
  })

  it('toont de totale verkoopprijs', () => {
    const total = result.breakdown.find((line) => line.key === 'totalSalePrice')
    expect(total?.amountCents).toBe(result.totalPaymentCents)
  })

  it('is deterministisch', () => {
    expect(calculateFinancing(FinancingType.MURABAHA, base)).toEqual(
      calculateFinancing(FinancingType.MURABAHA, base),
    )
  })
})

describe('ijara', () => {
  const result = expectAvailable(calculateFinancing(FinancingType.IJARA, base))

  it('benoemt de betaling als huur, niet als aflossing', () => {
    // Wat je betaalt is huur. Dat "aflossing" noemen beschrijft een andere
    // overeenkomst dan de gebruiker tekent.
    expect(result.paymentLabel.toLowerCase()).toContain('huur')
    const labels = result.breakdown.map((line) => line.label.toLowerCase()).join(' ')
    expect(labels).toContain('huur')
    expect(labels).not.toContain('rente')
  })

  it('waarschuwt dat de eigendom bij de financier ligt', () => {
    const ownership = result.assumptions.find((a) => a.key === 'ownership')
    expect(ownership?.value.toLowerCase()).toContain('financier')
  })
})

describe('afnemend partnerschap', () => {
  const result = expectAvailable(
    calculateFinancing(FinancingType.DIMINISHING_MUSHARAKA, base),
  )

  it('splitst het maandbedrag in vergoeding en overname', () => {
    const rent = result.breakdown.find((l) => l.key === 'firstRent')
    const acquisition = result.breakdown.find((l) => l.key === 'firstAcquisition')

    expect(rent?.amountCents).toBeGreaterThan(0)
    expect(acquisition?.amountCents).toBeGreaterThan(0)
    // Samen vormen ze het maandbedrag.
    expect(rent!.amountCents! + acquisition!.amountCents!).toBe(result.periodicPaymentCents)
  })

  it('gebruikt de eigen inbreng als startaandeel', () => {
    const share = result.breakdown.find((l) => l.key === 'ownerShare')
    expect(share?.amountCents).toBe(90_000 * 100)
    // 90.000 van 450.000 is 20 %.
    expect(share?.detail).toContain('20,0 %')
  })

  it('laat de vergoeding dalen en de overname stijgen', () => {
    const calculator = new DiminishingMusharakaCalculator()
    const schedule = calculator.schedule(base, 60)

    expect(schedule.length).toBeGreaterThan(1)

    const first = schedule[0]!
    const last = schedule.at(-1)!

    expect(last.rentCents).toBeLessThan(first.rentCents)
    expect(last.acquisitionCents).toBeGreaterThan(first.acquisitionCents)
  })

  it('brengt het aandeel aan het einde op 100 procent', () => {
    const calculator = new DiminishingMusharakaCalculator()
    const schedule = calculator.schedule(base, 12)

    expect(schedule.at(-1)!.ownerSharePercent).toBeCloseTo(100, 0)
  })

  it('geeft geen schema zonder tarief', () => {
    const calculator = new DiminishingMusharakaCalculator()
    expect(calculator.schedule({ ...base, profitRateBasisPoints: null })).toEqual([])
  })
})

describe('renteloze lening', () => {
  const result = expectAvailable(
    calculateFinancing(FinancingType.QARD_HASAN, { ...base, profitRateBasisPoints: 0 }),
  )

  it('verdeelt het bedrag gelijk over de looptijd', () => {
    expect(result.periodicPaymentCents).toBe(Math.round((360_000 * 100) / 240))
  })

  it('rekent niets bovenop het geleende bedrag', () => {
    expect(result.totalCostCents).toBe(0)
  })

  it('negeert een per ongeluk ingevuld tarief en zegt dat', () => {
    // Een tarief bij een qard hasan is een redactiefout; die rekenen we niet
    // stilzwijgend door.
    const withRate = expectAvailable(
      calculateFinancing(FinancingType.QARD_HASAN, { ...base, profitRateBasisPoints: 400 }),
    )

    expect(withRate.totalCostCents).toBe(0)
    expect(withRate.assumptions.some((a) => a.key === 'rate_ignored')).toBe(true)
  })
})

describe('klassiek krediet', () => {
  const result = expectAvailable(
    calculateFinancing(FinancingType.CONVENTIONAL_MORTGAGE, base),
  )

  it('noemt rente wél rente', () => {
    // De terminologie volgt de constructie; hier ís het rente.
    const labels = result.breakdown.map((line) => line.label.toLowerCase()).join(' ')
    expect(labels).toContain('rente')
  })

  it('presenteert zichzelf als referentiepunt, niet als aanbeveling', () => {
    const structure = result.assumptions.find((a) => a.key === 'structure')
    expect(structure?.value.toLowerCase()).toContain('referentiepunt')
  })
})

describe('gedeelde eigenschappen', () => {
  const types = [
    FinancingType.MURABAHA,
    FinancingType.IJARA,
    FinancingType.DIMINISHING_MUSHARAKA,
    FinancingType.QARD_HASAN,
    FinancingType.CONVENTIONAL_MORTGAGE,
  ]

  it('geeft overal de versie van de rekenmotor mee', () => {
    for (const type of types) {
      const result = calculateFinancing(type, base)
      expect(result.version, type).toBe(FINANCING_CALCULATOR_VERSION)
    }
  })

  it('rekent alles in hele centen', () => {
    for (const type of types) {
      const result = expectAvailable(calculateFinancing(type, base))

      for (const value of [
        result.amountFinancedCents,
        result.periodicPaymentCents,
        result.totalPaymentCents,
        result.totalCostCents,
        result.feesCents,
      ]) {
        expect(Number.isInteger(value), `${type}: ${value}`).toBe(true)
      }
    }
  })

  it('vermeldt overal wat er niet inbegrepen is', () => {
    for (const type of types) {
      const result = expectAvailable(calculateFinancing(type, base))
      const excluded = result.assumptions.find((a) => a.key === 'excluded')

      expect(excluded?.value, type).toContain('Registratierechten')
    }
  })

  it('zegt overal dat dit geen aanbod is', () => {
    for (const type of types) {
      const result = expectAvailable(calculateFinancing(type, base))
      const nature = result.assumptions.find((a) => a.key === 'nature')

      expect(nature?.value.toLowerCase(), type).toContain('geen aanbod')
    }
  })

  it('telt dossierkosten mee in de totale kost, niet in de maandbetaling', () => {
    for (const type of [FinancingType.MURABAHA, FinancingType.IJARA]) {
      const zonder = expectAvailable(calculateFinancing(type, base))
      const met = expectAvailable(calculateFinancing(type, { ...base, setupFeeAmount: 1000 }))

      expect(met.periodicPaymentCents, type).toBe(zonder.periodicPaymentCents)
      expect(met.totalCostCents, type).toBe(zonder.totalCostCents + 100_000)
    }
  })

  it('geeft een lagere maandlast maar hogere totale kost bij een langere looptijd', () => {
    const kort = expectAvailable(calculateFinancing(FinancingType.MURABAHA, { ...base, termMonths: 180 }))
    const lang = expectAvailable(calculateFinancing(FinancingType.MURABAHA, { ...base, termMonths: 300 }))

    expect(lang.periodicPaymentCents).toBeLessThan(kort.periodicPaymentCents)
    expect(lang.totalCostCents).toBeGreaterThan(kort.totalCostCents)
  })
})
