/**
 * Financieringsfouten met een stabiele code.
 *
 * De code is wat de API teruggeeft en waarop een client kan reageren; de
 * boodschap is voor de gebruiker. Zonder codes zou een client de Nederlandse
 * tekst moeten herkennen om te weten wat er misging — en dan breekt elke
 * herformulering een integratie.
 *
 * Geen enkele Prisma-fout mag hier doorheen: die bevat tabelnamen, kolomnamen
 * en soms de waarden uit de query.
 */
import { AppError } from '@/lib/errors'

export type FinancingErrorCode =
  | 'FINANCING_PRODUCT_NOT_FOUND'
  | 'FINANCING_PRODUCT_INACTIVE'
  | 'FINANCING_PROVIDER_NOT_FOUND'
  | 'CALCULATION_NOT_SUPPORTED'
  | 'INVALID_PURCHASE_PRICE'
  | 'INVALID_OWN_CONTRIBUTION'
  | 'INVALID_RATE'
  | 'TERM_NOT_SUPPORTED'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'OWN_CONTRIBUTION_TOO_LOW'
  | 'ASSESSMENT_INVALID'
  | 'QUOTE_NOT_FOUND'
  | 'CURRENCY_NOT_SUPPORTED'
  | 'COMPARISON_SIZE_INVALID'

export class FinancingError extends AppError {
  constructor(code: FinancingErrorCode, message: string, status = 400, details?: unknown) {
    super(message, status, code, details)
  }
}

export const financingErrors = {
  productNotFound: () =>
    new FinancingError(
      'FINANCING_PRODUCT_NOT_FOUND',
      'Dit financieringsproduct bestaat niet of is niet meer beschikbaar.',
      404,
    ),

  productInactive: () =>
    new FinancingError(
      'FINANCING_PRODUCT_INACTIVE',
      'Dit product wordt niet meer aangeboden. Bekijk de andere opties.',
      409,
    ),

  providerNotFound: () =>
    new FinancingError('FINANCING_PROVIDER_NOT_FOUND', 'Deze aanbieder bestaat niet.', 404),

  calculationNotSupported: (reason: string) =>
    new FinancingError('CALCULATION_NOT_SUPPORTED', reason, 422),

  amountOutOfRange: (message: string) =>
    new FinancingError('AMOUNT_OUT_OF_RANGE', message, 422),

  ownContributionTooLow: (message: string) =>
    new FinancingError('OWN_CONTRIBUTION_TOO_LOW', message, 422),

  termNotSupported: (message: string) =>
    new FinancingError('TERM_NOT_SUPPORTED', message, 422),

  /**
   * De shariah-beoordeling van dit product is intern inconsistent — bijvoorbeeld
   * `CERTIFIED` zonder certificerend orgaan. Zo'n product mag niet getoond
   * worden: de gebruiker ziet dan een sterk signaal dat hij niet kan
   * controleren.
   */
  assessmentInvalid: (problems: string[]) =>
    new FinancingError(
      'ASSESSMENT_INVALID',
      'De shariah-beoordeling van dit product is onvolledig. We tonen hem niet zolang de herkomst niet klopt.',
      409,
      { problems },
    ),

  quoteNotFound: () =>
    new FinancingError('QUOTE_NOT_FOUND', 'Deze berekening bestaat niet.', 404),

  currencyNotSupported: (currency: string) =>
    new FinancingError(
      'CURRENCY_NOT_SUPPORTED',
      `Munteenheid ${currency} wordt nog niet ondersteund.`,
      422,
    ),

  comparisonSizeInvalid: (message: string) =>
    new FinancingError('COMPARISON_SIZE_INVALID', message, 400),
}
