/**
 * Diminishing musharaka: afnemend partnerschap.
 *
 * Klant en financier bezitten de woning samen. Elke maand koopt de klant een
 * stuk van het aandeel van de financier over én betaalt hij een vergoeding voor
 * het gebruik van het deel dat nog niet van hem is.
 *
 * ─── WAT DEZE CALCULATOR WÉL KAN ─────────────────────────────────────────────
 *
 * De eigen inbreng ís het startaandeel van de klant. Daarmee is de opsplitsing
 * per maand in een overnamedeel en een gebruiksvergoeding werkelijk te
 * berekenen, en dat is precies de informatie die deze constructie begrijpelijk
 * maakt: de vergoeding daalt naarmate je aandeel groeit.
 *
 * Dat is geen benadering van een aflossingstabel maar de kern van het contract.
 * De totalen komen rekenkundig overeen met een annuïteit — onvermijdelijk bij
 * een vast maandbedrag — maar de opbouw die we tonen is die van het
 * partnerschap.
 *
 * ─── WAT HIJ NIET DOET ───────────────────────────────────────────────────────
 *
 * Zonder gepubliceerde vergoeding is er niets te berekenen. Dan komt er
 * `unavailable` terug in plaats van een generieke formule die toevallig een
 * bedrag oplevert.
 */
import { FinancingType } from '@prisma/client'

import {
  annuityCents,
  assertValidInput,
  baseAssumptions,
  CENTS_PER_UNIT,
  DEFAULT_CURRENCY,
  formatBasisPoints,
  monthlyRateFrom,
  unavailable,
  type FinancingCalculator,
  type FinancingInput,
  type FinancingResult,
  FINANCING_CALCULATOR_VERSION,
} from './types'

export interface MusharakaSchedulePoint {
  month: number
  /** Aandeel van de klant, in procenten met één decimaal. */
  ownerSharePercent: number
  rentCents: number
  acquisitionCents: number
}

export class DiminishingMusharakaCalculator implements FinancingCalculator {
  readonly name = 'diminishing-musharaka'

  supports(type: FinancingType): boolean {
    return type === FinancingType.DIMINISHING_MUSHARAKA
  }

  calculate(input: FinancingInput): FinancingResult {
    assertValidInput(input)

    if (input.profitRateBasisPoints === null || input.profitRateBasisPoints === undefined) {
      return unavailable(
        FinancingType.DIMINISHING_MUSHARAKA,
        'Deze aanbieder publiceert geen gebruiksvergoeding. Zonder dat gegeven kunnen we je maandbedrag niet opsplitsen in huur en overname.',
        ['profitRateBasisPoints'],
      )
    }

    const financierShareCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const feesCents = (input.setupFeeAmount ?? 0) * CENTS_PER_UNIT
    const purchaseCents = input.purchasePrice * CENTS_PER_UNIT

    const monthlyRate = monthlyRateFrom(input.profitRateBasisPoints)
    const monthly = annuityCents(financierShareCents, monthlyRate, input.termMonths)

    // De eerste maand: vergoeding over het volledige aandeel van de financier,
    // de rest gaat naar overname. Dit is het getal dat de constructie uitlegt.
    const firstRentCents = Math.round(financierShareCents * monthlyRate)
    const firstAcquisitionCents = monthly - firstRentCents

    const totalPaymentCents = monthly * input.termMonths
    const totalRentCents = totalPaymentCents - financierShareCents

    const startSharePercent = (input.ownContribution / input.purchasePrice) * 100

    return {
      available: true,
      financingType: FinancingType.DIMINISHING_MUSHARAKA,
      currency: input.currency ?? DEFAULT_CURRENCY,

      amountFinancedCents: financierShareCents,
      periodicPaymentCents: monthly,
      paymentLabel: 'Maandbedrag (gebruiksvergoeding + overname)',
      periodsPerYear: 12,

      totalPaymentCents,
      totalCostCents: totalRentCents + feesCents,
      feesCents,
      termMonths: input.termMonths,

      breakdown: [
        {
          key: 'ownerShare',
          label: 'Jouw aandeel bij aanvang',
          amountCents: input.ownContribution * CENTS_PER_UNIT,
          detail: `${startSharePercent.toFixed(1).replace('.', ',')} % van de woning.`,
        },
        {
          key: 'financierShare',
          label: 'Aandeel van de financier bij aanvang',
          amountCents: financierShareCents,
          detail: `${(100 - startSharePercent).toFixed(1).replace('.', ',')} % van de woning.`,
        },
        {
          key: 'firstRent',
          label: 'Gebruiksvergoeding in de eerste maand',
          amountCents: firstRentCents,
          detail: 'Daalt elke maand, omdat het aandeel van de financier kleiner wordt.',
        },
        {
          key: 'firstAcquisition',
          label: 'Overname in de eerste maand',
          amountCents: firstAcquisitionCents,
          detail: 'Stijgt elke maand, omdat er minder vergoeding betaald hoeft te worden.',
        },
        {
          key: 'totalRent',
          label: 'Totale gebruiksvergoeding over de looptijd',
          amountCents: totalRentCents,
        },
        {
          key: 'totalValue',
          label: 'Waarde van de woning bij aanvang',
          amountCents: purchaseCents,
        },
        ...(feesCents > 0
          ? [{ key: 'fees', label: 'Eenmalige dossierkosten', amountCents: feesCents }]
          : []),
      ],

      assumptions: [
        {
          key: 'formula',
          label: 'Berekeningsmethode',
          value:
            'Vast maandbedrag. Daarbinnen daalt de gebruiksvergoeding en stijgt de overname, naarmate je aandeel groeit.',
        },
        {
          key: 'rate_basis',
          label: 'Gebruiksvergoeding',
          value: `${formatBasisPoints(input.profitRateBasisPoints)} per jaar over het deel dat nog niet van jou is.`,
        },
        {
          key: 'structure',
          label: 'Constructie',
          value:
            'Diminishing musharaka: je koopt de woning samen met de financier en neemt zijn aandeel maandelijks over.',
        },
        {
          key: 'share_start',
          label: 'Startaandeel',
          value: `Je eigen inbreng bepaalt je startaandeel: ${startSharePercent.toFixed(1).replace('.', ',')} %.`,
        },
        ...baseAssumptions(input),
      ],

      version: FINANCING_CALCULATOR_VERSION,
    }
  }

  /**
   * Het verloop van het partnerschap, per jaar.
   *
   * Apart van `calculate()` omdat niet elk scherm het nodig heeft en een tabel
   * van 300 rijen niets toevoegt aan een vergelijking. De productdetailpagina
   * toont hem wel: hij maakt zichtbaar wat "afnemend" betekent.
   */
  schedule(input: FinancingInput, everyMonths = 12): MusharakaSchedulePoint[] {
    assertValidInput(input)
    if (input.profitRateBasisPoints === null || input.profitRateBasisPoints === undefined) {
      return []
    }

    const purchaseCents = input.purchasePrice * CENTS_PER_UNIT
    const monthlyRate = monthlyRateFrom(input.profitRateBasisPoints)

    let outstandingCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const monthly = annuityCents(outstandingCents, monthlyRate, input.termMonths)

    const points: MusharakaSchedulePoint[] = []

    for (let month = 1; month <= input.termMonths; month++) {
      const rentCents = Math.round(outstandingCents * monthlyRate)
      // In de laatste maand kan afronding een restje geven; dat schuiven we
      // naar de overname zodat het aandeel exact op 100 % uitkomt.
      const acquisitionCents = Math.min(monthly - rentCents, outstandingCents)
      outstandingCents -= acquisitionCents

      if (month % everyMonths === 0 || month === input.termMonths) {
        points.push({
          month,
          ownerSharePercent: Number(
            (((purchaseCents - outstandingCents) / purchaseCents) * 100).toFixed(1),
          ),
          rentCents,
          acquisitionCents,
        })
      }
    }

    return points
  }
}
