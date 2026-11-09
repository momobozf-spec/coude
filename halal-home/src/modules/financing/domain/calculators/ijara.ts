/**
 * Ijara: huur met eigendomsoverdracht aan het einde.
 *
 * De financier is eigenaar, de klant huurt, en bij het einde van de looptijd
 * gaat de eigendom over. Wat je maandelijks betaalt is HUUR — geen aflossing.
 *
 * Dat onderscheid is de reden dat deze calculator apart bestaat. De uitkomst
 * heet "maandelijkse huur", en de totale kost heet "totale huursom". Wie dat
 * "rente" noemt, beschrijft een andere overeenkomst dan de gebruiker tekent.
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

export class IjaraCalculator implements FinancingCalculator {
  readonly name = 'ijara'

  supports(type: FinancingType): boolean {
    return type === FinancingType.IJARA
  }

  calculate(input: FinancingInput): FinancingResult {
    assertValidInput(input)

    if (input.profitRateBasisPoints === null || input.profitRateBasisPoints === undefined) {
      return unavailable(
        FinancingType.IJARA,
        'Deze aanbieder publiceert geen huurcomponent. Vraag een offerte aan om je maandelijkse huur te kennen.',
        ['profitRateBasisPoints'],
      )
    }

    const financedCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const feesCents = (input.setupFeeAmount ?? 0) * CENTS_PER_UNIT

    const monthlyRent = annuityCents(
      financedCents,
      monthlyRateFrom(input.profitRateBasisPoints),
      input.termMonths,
    )

    const totalRentCents = monthlyRent * input.termMonths
    const rentAboveValueCents = totalRentCents - financedCents

    return {
      available: true,
      financingType: FinancingType.IJARA,
      currency: input.currency ?? DEFAULT_CURRENCY,

      amountFinancedCents: financedCents,
      periodicPaymentCents: monthlyRent,
      paymentLabel: 'Maandelijkse huur',
      periodsPerYear: 12,

      totalPaymentCents: totalRentCents,
      totalCostCents: rentAboveValueCents + feesCents,
      feesCents,
      termMonths: input.termMonths,

      breakdown: [
        {
          key: 'financed',
          label: 'Waarde die de financier inbrengt',
          amountCents: financedCents,
        },
        {
          key: 'rentAboveValue',
          label: 'Huur boven de ingebrachte waarde',
          amountCents: rentAboveValueCents,
          detail: 'De vergoeding van de financier over de volledige looptijd.',
        },
        {
          key: 'totalRent',
          label: 'Totale huursom',
          amountCents: totalRentCents,
        },
        ...(feesCents > 0
          ? [{ key: 'fees', label: 'Eenmalige dossierkosten', amountCents: feesCents }]
          : []),
      ],

      assumptions: [
        {
          key: 'formula',
          label: 'Berekeningsmethode',
          value: 'Gelijke maandelijkse huur over de volledige looptijd.',
        },
        {
          key: 'rent_basis',
          label: 'Huurcomponent',
          value: `${formatBasisPoints(input.profitRateBasisPoints)} per jaar over de ingebrachte waarde.`,
        },
        {
          key: 'structure',
          label: 'Constructie',
          value:
            'Ijara: de financier is eigenaar en jij huurt. De eigendomsoverdracht aan het einde staat in het contract van de aanbieder — lees na hoe die precies geregeld is.',
        },
        {
          key: 'ownership',
          label: 'Eigendom tijdens de looptijd',
          value:
            'De woning staat op naam van de financier tot de overdracht. Dat heeft gevolgen voor verzekering en verkoop; vraag ernaar.',
        },
        ...baseAssumptions(input),
      ],

      version: FINANCING_CALCULATOR_VERSION,
    }
  }
}
