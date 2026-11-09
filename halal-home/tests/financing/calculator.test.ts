import { describe, expect, it } from 'vitest'
import { FinancingType } from '@prisma/client'

import {
  CalculationError,
  calculateFinancing,
  checkEligibility,
  ownContributionPercentage,
} from '@/modules/financing/domain/calculator'

const base = {
  purchasePrice: 450_000,
  ownContribution: 90_000,
  termMonths: 240,
  profitRateBasisPoints: 400,
}

describe('financieringsberekening', () => {
  it('financiert het verschil tussen prijs en eigen inbreng', () => {
    const result = calculateFinancing(base)
    expect(result.amountFinancedCents).toBe(360_000 * 100)
  })

  it('is deterministisch: dezelfde invoer geeft exact dezelfde uitvoer', () => {
    // Dit is het getal waarop iemand een aankoop van een half miljoen baseert.
    const a = calculateFinancing(base)
    const b = calculateFinancing(base)
    expect(a).toEqual(b)
  })

  it('berekent de maandlast met de annuïteitenformule', () => {
    // 360.000 € over 240 maanden bij 4 % geeft ~2.181,50 € per maand.
    const result = calculateFinancing(base)
    expect(result.monthlyPaymentCents).toBeGreaterThan(210_000)
    expect(result.monthlyPaymentCents).toBeLessThan(230_000)
  })

  it('verdeelt bij een tarief van 0 het bedrag gelijk over de looptijd', () => {
    // Zonder deze uitzondering deelt de formule door nul en toont de app
    // "NaN €" als maandlast.
    const result = calculateFinancing({ ...base, profitRateBasisPoints: 0 })
    expect(result.monthlyPaymentCents).toBe(Math.round((360_000 * 100) / 240))
    expect(result.totalCostCents).toBe(0)
  })

  it('telt de totale betaling op als maandlast maal looptijd', () => {
    const result = calculateFinancing(base)
    expect(result.totalPaymentCents).toBe(result.monthlyPaymentCents * result.termMonths)
  })

  it('rekent dossierkosten mee in de totale kost, niet in de maandlast', () => {
    const zonder = calculateFinancing(base)
    const met = calculateFinancing({ ...base, setupFeeAmount: 1000 })

    expect(met.monthlyPaymentCents).toBe(zonder.monthlyPaymentCents)
    expect(met.totalCostCents).toBe(zonder.totalCostCents + 100_000)
  })

  it('geeft een hogere maandlast bij een hoger tarief', () => {
    const laag = calculateFinancing({ ...base, profitRateBasisPoints: 300 })
    const hoog = calculateFinancing({ ...base, profitRateBasisPoints: 500 })
    expect(hoog.monthlyPaymentCents).toBeGreaterThan(laag.monthlyPaymentCents)
  })

  it('geeft een lagere maandlast maar hogere totale kost bij een langere looptijd', () => {
    const kort = calculateFinancing({ ...base, termMonths: 180 })
    const lang = calculateFinancing({ ...base, termMonths: 300 })

    expect(lang.monthlyPaymentCents).toBeLessThan(kort.monthlyPaymentCents)
    expect(lang.totalCostCents).toBeGreaterThan(kort.totalCostCents)
  })

  it('rekent alle bedragen in hele centen', () => {
    const result = calculateFinancing({ ...base, profitRateBasisPoints: 337 })
    for (const value of [
      result.amountFinancedCents,
      result.monthlyPaymentCents,
      result.totalPaymentCents,
      result.totalCostCents,
    ]) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('geeft de aannames mee terug', () => {
    // Zonder aannames is een bedrag een bewering zonder onderbouwing; die
    // worden opgeslagen bij de quote zodat de gebruiker ze later terugvindt.
    const result = calculateFinancing({ ...base, financingType: FinancingType.MURABAHA })
    const keys = result.assumptions.map((a) => a.key)

    expect(keys).toContain('formula')
    expect(keys).toContain('rate')
    expect(keys).toContain('excluded')
    expect(keys).toContain('structure')
    // Expliciet: dit is geen aanbod.
    expect(keys).toContain('nature')
  })

  it('vermeldt de versie van de rekenmethode', () => {
    expect(calculateFinancing(base).version).toBeGreaterThan(0)
  })
})

describe('invoervalidatie', () => {
  it('weigert een eigen inbreng die de hele prijs dekt', () => {
    expect(() =>
      calculateFinancing({ ...base, ownContribution: base.purchasePrice }),
    ).toThrow(CalculationError)
  })

  it('weigert een negatieve eigen inbreng', () => {
    expect(() => calculateFinancing({ ...base, ownContribution: -1 })).toThrow(CalculationError)
  })

  it('weigert een looptijd buiten het bereik', () => {
    expect(() => calculateFinancing({ ...base, termMonths: 0 })).toThrow(CalculationError)
    expect(() => calculateFinancing({ ...base, termMonths: 600 })).toThrow(CalculationError)
  })

  it('weigert een onwaarschijnlijk hoog tarief als invoerfout', () => {
    expect(() => calculateFinancing({ ...base, profitRateBasisPoints: 5000 })).toThrow(
      CalculationError,
    )
  })

  it('weigert niet-gehele bedragen', () => {
    expect(() => calculateFinancing({ ...base, purchasePrice: 450_000.5 })).toThrow(
      CalculationError,
    )
  })
})

describe('eigen inbreng', () => {
  it('rekent het percentage uit', () => {
    expect(ownContributionPercentage(450_000, 90_000)).toBe(20)
    expect(ownContributionPercentage(0, 0)).toBe(0)
  })
})

describe('komt de aanvraag in aanmerking', () => {
  const constraints = {
    minAmount: 50_000,
    maxAmount: 500_000,
    minOwnContributionPercentage: 20,
    termMinMonths: 120,
    termMaxMonths: 300,
  }

  it('laat een passende aanvraag door', () => {
    const result = checkEligibility(
      { purchasePrice: 450_000, ownContribution: 90_000, termMonths: 240 },
      constraints,
    )
    expect(result.eligible).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('noemt de reden bij te weinig eigen inbreng', () => {
    // "Je komt niet in aanmerking" zonder reden is precies de
    // ondoorzichtigheid waar dit platform tegenover staat.
    const result = checkEligibility(
      { purchasePrice: 450_000, ownContribution: 45_000, termMonths: 240 },
      constraints,
    )
    expect(result.eligible).toBe(false)
    expect(result.reasons[0]).toContain('20 %')
  })

  it('verzamelt meerdere redenen tegelijk', () => {
    const result = checkEligibility(
      { purchasePrice: 900_000, ownContribution: 0, termMonths: 360 },
      constraints,
    )
    expect(result.reasons.length).toBeGreaterThanOrEqual(3)
  })

  it('negeert grenzen die niet ingevuld zijn', () => {
    const result = checkEligibility(
      { purchasePrice: 450_000, ownContribution: 10_000, termMonths: 12 },
      {
        minAmount: null,
        maxAmount: null,
        minOwnContributionPercentage: null,
        termMinMonths: null,
        termMaxMonths: null,
      },
    )
    expect(result.eligible).toBe(true)
  })
})
