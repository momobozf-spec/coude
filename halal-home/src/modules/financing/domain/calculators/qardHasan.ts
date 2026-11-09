/**
 * Qard hasan: renteloze lening.
 *
 * Je betaalt terug wat je geleend hebt, meer niet. Eventuele dossierkosten
 * staan los en zijn eenmalig.
 *
 * Deze calculator negeert een eventueel gepubliceerd tarief bewust: bij een
 * qard hasan hoort er geen vergoeding op het geleende bedrag te zitten. Staat er
 * toch een tarief in de productdata, dan is dat een redactiefout die we niet
 * stilzwijgend doorrekenen — de uitkomst blijft renteloos en de aanname zegt het.
 */
import { FinancingType } from '@prisma/client'

import {
  assertValidInput,
  baseAssumptions,
  CENTS_PER_UNIT,
  DEFAULT_CURRENCY,
  type FinancingCalculator,
  type FinancingInput,
  type FinancingResult,
  FINANCING_CALCULATOR_VERSION,
} from './types'

export class QardHasanCalculator implements FinancingCalculator {
  readonly name = 'qard-hasan'

  supports(type: FinancingType): boolean {
    return type === FinancingType.QARD_HASAN
  }

  calculate(input: FinancingInput): FinancingResult {
    assertValidInput(input)

    const financedCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const feesCents = (input.setupFeeAmount ?? 0) * CENTS_PER_UNIT
    const monthly = Math.round(financedCents / input.termMonths)

    return {
      available: true,
      financingType: FinancingType.QARD_HASAN,
      currency: input.currency ?? DEFAULT_CURRENCY,

      amountFinancedCents: financedCents,
      periodicPaymentCents: monthly,
      paymentLabel: 'Maandelijkse aflossing',
      periodsPerYear: 12,

      totalPaymentCents: monthly * input.termMonths,
      // Alleen de kosten; op het geleende bedrag komt niets bij.
      totalCostCents: feesCents,
      feesCents,
      termMonths: input.termMonths,

      breakdown: [
        { key: 'financed', label: 'Geleend bedrag', amountCents: financedCents },
        {
          key: 'markup',
          label: 'Vergoeding op het geleende bedrag',
          amountCents: 0,
          detail: 'Geen. Bij een qard hasan betaal je terug wat je leende.',
        },
        ...(feesCents > 0
          ? [
              {
                key: 'fees',
                label: 'Eenmalige dossierkosten',
                amountCents: feesCents,
                detail: 'Administratiekosten, los van het geleende bedrag.',
              },
            ]
          : []),
      ],

      assumptions: [
        {
          key: 'formula',
          label: 'Berekeningsmethode',
          value: 'Het geleende bedrag gelijk verdeeld over de looptijd.',
        },
        {
          key: 'structure',
          label: 'Constructie',
          value: 'Qard hasan: een lening zonder vergoeding op het geleende bedrag.',
        },
        ...(input.profitRateBasisPoints
          ? [
              {
                key: 'rate_ignored',
                label: 'Gepubliceerd tarief genegeerd',
                value:
                  'Bij dit product staat een tarief vermeld. Een qard hasan hoort geen vergoeding op het geleende bedrag te kennen; wij rekenen daarom renteloos en raden aan dit bij de aanbieder na te vragen.',
              },
            ]
          : []),
        ...baseAssumptions(input),
      ],

      version: FINANCING_CALCULATOR_VERSION,
    }
  }
}
