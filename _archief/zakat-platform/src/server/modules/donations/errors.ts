import { AppError } from '@/lib/errors'

/**
 * Donation domain errors (§33).
 *
 * Each carries a message the user can act on. Prisma errors never reach the
 * browser — `respond.ts` maps these by status.
 */

export class DonationNotFoundError extends AppError {
  constructor(message = 'Deze donatie bestaat niet.') {
    super(message, { status: 404, code: 'DONATION_NOT_FOUND' })
  }
}

export class InvalidDonationAmountError extends AppError {
  constructor(message = 'Een donatie moet groter zijn dan nul.') {
    super(message, { status: 422, code: 'INVALID_DONATION_AMOUNT' })
  }
}

/** Only a finalised calculation may receive payments (§3). */
export class CalculationNotFinalizedError extends AppError {
  constructor(
    message = 'Je kunt alleen betalingen koppelen aan een afgeronde Zakat-berekening. ' +
      'Rond de berekening eerst af.',
  ) {
    super(message, { status: 409, code: 'CALCULATION_NOT_FINALIZED' })
  }
}

/** Wrong donation type, or a currency that does not match the calculation. */
export class DonationCalculationMismatchError extends AppError {
  constructor(message = 'Deze donatie past niet bij de gekozen Zakat-berekening.') {
    super(message, { status: 422, code: 'DONATION_CALCULATION_MISMATCH' })
  }
}

export class DonationVoidedError extends AppError {
  constructor(
    message = 'Deze donatie is ingetrokken en kan niet meer gewijzigd worden. ' +
      'Registreer zo nodig een nieuwe donatie.',
  ) {
    super(message, { status: 409, code: 'DONATION_VOIDED' })
  }
}

export class ReceiptTooLargeError extends AppError {
  constructor(maxBytes: number) {
    super(`Het bestand is te groot. Maximaal ${Math.round(maxBytes / 1024 / 1024)} MB.`, {
      status: 413,
      code: 'RECEIPT_TOO_LARGE',
    })
  }
}

export class InvalidReceiptTypeError extends AppError {
  constructor(message = 'Alleen PDF, JPG, PNG en WEBP zijn toegestaan als bewijsstuk.') {
    super(message, { status: 415, code: 'INVALID_RECEIPT_TYPE' })
  }
}

export class SadaqahGoalNotFoundError extends AppError {
  constructor(message = 'Dit Sadaqah-doel bestaat niet.') {
    super(message, { status: 404, code: 'SADAQAH_GOAL_NOT_FOUND' })
  }
}

export class InvalidGoalPeriodError extends AppError {
  constructor(message = 'De opgegeven periode voor dit doel klopt niet.') {
    super(message, { status: 422, code: 'INVALID_GOAL_PERIOD' })
  }
}
