/**
 * Het register van rekenmodellen.
 *
 * Een constructie toevoegen is: een klasse schrijven die `FinancingCalculator`
 * implementeert en hem hier in de lijst zetten. Geen `switch` die met elk
 * product groeit, en geen aanroeper die verandert.
 *
 * Constructies zonder calculator geven expliciet `unavailable` terug. Dat is
 * het gedrag dat we willen: liever "berekening niet beschikbaar" met een reden
 * dan een generieke formule die de constructie verkeerd beschrijft.
 */
import { FinancingType } from '@prisma/client'

import { ConventionalMortgageCalculator } from './conventional'
import { DiminishingMusharakaCalculator } from './diminishingMusharaka'
import { IjaraCalculator } from './ijara'
import { MurabahaCalculator } from './murabaha'
import { QardHasanCalculator } from './qardHasan'
import {
  unavailable,
  type FinancingCalculator,
  type FinancingInput,
  type FinancingResult,
} from './types'

const CALCULATORS: readonly FinancingCalculator[] = [
  new MurabahaCalculator(),
  new IjaraCalculator(),
  new DiminishingMusharakaCalculator(),
  new QardHasanCalculator(),
  new ConventionalMortgageCalculator(),
]

/** De calculator voor deze constructie, of null wanneer we hem niet kennen. */
export function calculatorFor(type: FinancingType): FinancingCalculator | null {
  return CALCULATORS.find((calculator) => calculator.supports(type)) ?? null
}

export function isCalculationSupported(type: FinancingType): boolean {
  return calculatorFor(type) !== null
}

/**
 * Rekent een financiering door.
 *
 * Gooit alleen bij ongeldige INVOER (`FinancingInputError`). Ontbrekende
 * PRODUCTGEGEVENS zijn geen fout maar een uitkomst: dan komt er een
 * `unavailable`-resultaat terug met de reden erbij, en die reden hoort de
 * gebruiker te lezen.
 */
export function calculateFinancing(
  type: FinancingType,
  input: FinancingInput,
): FinancingResult {
  const calculator = calculatorFor(type)

  if (!calculator) {
    return unavailable(
      type,
      'Voor deze financieringsvorm hebben we nog geen rekenmodel. Vraag een offerte aan bij de aanbieder.',
      [],
    )
  }

  return calculator.calculate(input)
}

/** De constructies waarvoor we kunnen rekenen. Voor filters in de UI. */
export function supportedFinancingTypes(): FinancingType[] {
  return Object.values(FinancingType).filter(isCalculationSupported)
}

export { DiminishingMusharakaCalculator }
export * from './types'
