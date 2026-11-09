import { describe, expect, it } from 'vitest'

import {
  CENTS_PER_EURO,
  MoneyError,
  centsFromEuros,
  eurosFromCents,
  formatCents,
  parseAmountToCents,
  roundToWholeEuros,
} from '@/lib/money'

describe('omzetten tussen euro en cent', () => {
  it('zet hele euros om naar centen', () => {
    expect(centsFromEuros(450_000)).toBe(45_000_000)
    expect(centsFromEuros(0)).toBe(0)
  })

  it('weigert een bedrag met decimalen als euro-invoer', () => {
    expect(() => centsFromEuros(450.5)).toThrow(MoneyError)
  })

  it('zet centen terug naar hele euros', () => {
    expect(eurosFromCents(45_000_000)).toBe(450_000)
  })

  it('weigert stil af te ronden bij centen die geen hele euro vormen', () => {
    // Dit is het hele punt: een stille afronding is een gewoonte die later
    // in een fiscale berekening wél iets kost.
    expect(() => eurosFromCents(45_000_050)).toThrow(MoneyError)
  })

  it('rondt wel af wanneer dat expliciet gevraagd wordt', () => {
    expect(roundToWholeEuros(45_000_050)).toBe(450_001)
    expect(roundToWholeEuros(45_000_049)).toBe(450_000)
  })

  it('is rondrekenbaar', () => {
    for (const euros of [0, 1, 999, 450_000]) {
      expect(eurosFromCents(centsFromEuros(euros))).toBe(euros)
    }
  })

  it('weigert negatieve en absurd hoge bedragen', () => {
    expect(() => eurosFromCents(-1)).toThrow(MoneyError)
    expect(() => eurosFromCents(50_000_001 * CENTS_PER_EURO)).toThrow(MoneyError)
  })
})

describe('invoer van de gebruiker lezen', () => {
  it('leest een plat getal', () => {
    expect(parseAmountToCents('450000')).toBe(45_000_000)
  })

  it('leest Belgische notatie met duizendtalpunten', () => {
    expect(parseAmountToCents('450.000')).toBe(45_000_000)
    expect(parseAmountToCents('1.250.000')).toBe(125_000_000)
  })

  it('leest een komma als decimaalteken', () => {
    expect(parseAmountToCents('450.000,50')).toBe(45_000_050)
    expect(parseAmountToCents('19,99')).toBe(1_999)
  })

  it('negeert euroteken en spaties', () => {
    expect(parseAmountToCents('€ 450.000')).toBe(45_000_000)
    expect(parseAmountToCents(' 450 000 ')).toBe(45_000_000)
  })

  it('rekent decimalen exact af, zonder floating-point drift', () => {
    // 19.99 * 100 is in JavaScript 1998.9999999999998. Daarom gaat de
    // omzetting via de string en niet via vermenigvuldigen.
    expect(parseAmountToCents('19,99')).toBe(1999)
    expect(parseAmountToCents('0,07')).toBe(7)
    expect(parseAmountToCents('1234,56')).toBe(123_456)
  })

  it('vult ontbrekende centen aan', () => {
    expect(parseAmountToCents('10,5')).toBe(1_050)
  })

  it('geeft null bij lege invoer', () => {
    // Een leeg veld is "nog niet ingevuld"; dat is iets anders dan een fout.
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('   ')).toBeNull()
    expect(parseAmountToCents(null)).toBeNull()
    expect(parseAmountToCents(undefined)).toBeNull()
  })

  it('gooit bij onleesbare invoer', () => {
    for (const input of ['abc', '12,345', '4.5.6', '-100', '1,2,3']) {
      expect(() => parseAmountToCents(input), input).toThrow(MoneyError)
    }
  })

  it('gooit bij een absurd bedrag', () => {
    expect(() => parseAmountToCents('99000000')).toThrow(MoneyError)
  })
})

describe('weergave', () => {
  it('laat de centen weg wanneer ze nul zijn', () => {
    const formatted = formatCents(45_000_000)
    expect(formatted).toContain('450')
    expect(formatted).not.toContain(',00')
  })

  it('toont de centen wanneer die er zijn', () => {
    expect(formatCents(45_000_050)).toContain(',50')
  })

  it('toont een streepje bij een ontbrekend bedrag', () => {
    expect(formatCents(null)).toBe('—')
    expect(formatCents(undefined)).toBe('—')
  })
})
