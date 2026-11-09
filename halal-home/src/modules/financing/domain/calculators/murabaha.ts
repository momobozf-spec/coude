/**
 * Murabaha: koop met vaste opslag.
 *
 * De financier koopt de woning en verkoopt hem aan de klant door tegen een
 * vooraf vastgelegde totaalprijs. Die prijs staat vast bij ondertekening en
 * verandert daarna niet meer.
 *
 * WAT DIT NIET IS: rente. De uitkomst wordt daarom benoemd als "verkoopprijs"
 * en "opslag", niet als hoofdsom en rente. De rekenkundige vorm lijkt op een
 * annuïteit — dat is onvermijdelijk, want een vast bedrag over een vaste
 * looptijd is nu eenmaal een annuïteit — maar wat de gebruiker leest, beschrijft
 * de constructie zoals de aanbieder hem documenteert.
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

export class MurabahaCalculator implements FinancingCalculator {
  readonly name = 'murabaha'

  supports(type: FinancingType): boolean {
    return type === FinancingType.MURABAHA
  }

  calculate(input: FinancingInput): FinancingResult {
    assertValidInput(input)

    if (input.profitRateBasisPoints === null || input.profitRateBasisPoints === undefined) {
      return unavailable(
        FinancingType.MURABAHA,
        'Deze aanbieder publiceert geen winstmarge. Vraag een offerte aan om je totale verkoopprijs te kennen.',
        ['profitRateBasisPoints'],
      )
    }

    const financedCents = (input.purchasePrice - input.ownContribution) * CENTS_PER_UNIT
    const feesCents = (input.setupFeeAmount ?? 0) * CENTS_PER_UNIT

    const monthly = annuityCents(
      financedCents,
      monthlyRateFrom(input.profitRateBasisPoints),
      input.termMonths,
    )

    const totalPaymentCents = monthly * input.termMonths
    // De opslag is het verschil tussen wat je in totaal betaalt en wat er
    // gefinancierd werd. Bij murabaha ís dat de winst van de financier.
    const markupCents = totalPaymentCents - financedCents

    return {
      available: true,
      financingType: FinancingType.MURABAHA,
      currency: input.currency ?? DEFAULT_CURRENCY,

      amountFinancedCents: financedCents,
      periodicPaymentCents: monthly,
      paymentLabel: 'Maandelijkse termijn',
      periodsPerYear: 12,

      totalPaymentCents,
      totalCostCents: markupCents + feesCents,
      feesCents,
      termMonths: input.termMonths,

      breakdown: [
        {
          key: 'financed',
          label: 'Aankoopdeel dat de financier voorschiet',
          amountCents: financedCents,
        },
        {
          key: 'markup',
          label: 'Opslag van de financier',
          amountCents: markupCents,
          detail: 'Ligt vast bij ondertekening en verandert daarna niet.',
        },
        {
          key: 'totalSalePrice',
          label: 'Totale verkoopprijs',
          amountCents: financedCents + markupCents,
          detail: 'Wat je in totaal aan de financier betaalt, exclusief kosten.',
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
            'Vaste totaalprijs, gespreid over gelijke maandelijkse termijnen over de volledige looptijd.',
        },
        {
          key: 'markup_basis',
          label: 'Opslag',
          value: `${formatBasisPoints(input.profitRateBasisPoints)} per jaar, zoals vermeld op het productblad.`,
        },
        {
          key: 'structure',
          label: 'Constructie',
          value:
            'Murabaha: de financier koopt de woning en verkoopt hem aan jou door tegen een vooraf afgesproken totaalprijs.',
        },
        ...baseAssumptions(input),
        ...(feesCents > 0
          ? [
              {
                key: 'fees',
                label: 'Dossierkosten',
                value: `${input.setupFeeAmount} eenmalig, meegeteld in de totale kost maar niet gespreid over de maanden.`,
              },
            ]
          : []),
      ],

      version: FINANCING_CALCULATOR_VERSION,
    }
  }
}
