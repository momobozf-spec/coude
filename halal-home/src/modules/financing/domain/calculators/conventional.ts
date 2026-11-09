/**
 * Klassiek hypothecair krediet.
 *
 * Staat in het platform als referentiepunt, niet als aanbeveling: pas door het
 * verschil te zien met een murabaha of musharaka begrijpt iemand wat die
 * constructies kosten en hoe ze werken.
 *
 * Hier heten de dingen wél wat ze zijn: hoofdsom en rente. Dat is het spiegelde
 * geval van de andere calculators — de terminologie volgt de constructie, en
 * bij dit product ís het rente.
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

export class ConventionalMortgageCalculator implements FinancingCalculator {
  readonly name = 'conventional-mortgage'

  supports(type: FinancingType): boolean {
    return type === FinancingType.CONVENTIONAL_MORTGAGE
  }

  calculate(input: FinancingInput): FinancingResult {
    assertValidInput(input)

    if (input.profitRateBasisPoints === null || input.profitRateBasisPoints === undefined) {
      return unavailable(
        FinancingType.CONVENTIONAL_MORTGAGE,
        'Voor dit product is geen rentevoet gepubliceerd.',
        ['profitRateBasisPoints'],
      )
    }

    const principalCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const feesCents = (input.setupFeeAmount ?? 0) * CENTS_PER_UNIT

    const monthly = annuityCents(
      principalCents,
      monthlyRateFrom(input.profitRateBasisPoints),
      input.termMonths,
    )

    const totalPaymentCents = monthly * input.termMonths
    const interestCents = totalPaymentCents - principalCents

    return {
      available: true,
      financingType: FinancingType.CONVENTIONAL_MORTGAGE,
      currency: input.currency ?? DEFAULT_CURRENCY,

      amountFinancedCents: principalCents,
      periodicPaymentCents: monthly,
      paymentLabel: 'Maandelijkse aflossing',
      periodsPerYear: 12,

      totalPaymentCents,
      totalCostCents: interestCents + feesCents,
      feesCents,
      termMonths: input.termMonths,

      breakdown: [
        { key: 'financed', label: 'Geleend bedrag', amountCents: principalCents },
        { key: 'interest', label: 'Rente over de looptijd', amountCents: interestCents },
        { key: 'total', label: 'Totaal terug te betalen', amountCents: totalPaymentCents },
        ...(feesCents > 0
          ? [{ key: 'fees', label: 'Eenmalige dossierkosten', amountCents: feesCents }]
          : []),
      ],

      assumptions: [
        {
          key: 'formula',
          label: 'Berekeningsmethode',
          value: 'Annuïteit: gelijk maandbedrag van hoofdsom plus rente.',
        },
        {
          key: 'rate',
          label: 'Rentevoet',
          value: `${formatBasisPoints(input.profitRateBasisPoints)} per jaar.`,
        },
        {
          key: 'structure',
          label: 'Constructie',
          value:
            'Klassiek hypothecair krediet met rente. Opgenomen als referentiepunt, niet als aanbeveling.',
        },
        ...baseAssumptions(input),
      ],

      version: FINANCING_CALCULATOR_VERSION,
    }
  }
}
