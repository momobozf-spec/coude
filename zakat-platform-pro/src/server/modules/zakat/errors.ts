import { AppError } from '@/lib/errors'

/**
 * Zakat domain errors (§36).
 *
 * Every one of these carries a message the user can act on. A Prisma error, a
 * provider stack trace or a bare 500 never reaches the client — `respond.ts`
 * maps these by their status.
 */

export class ZakatProfileNotFoundError extends AppError {
  constructor(message = 'Je Zakat-profiel bestaat nog niet. Rond eerst de onboarding af.') {
    super(message, { status: 404, code: 'ZAKAT_PROFILE_NOT_FOUND' })
  }
}

export class InvalidNisabConfigurationError extends AppError {
  constructor(message = 'De nisab-instelling is onvolledig.') {
    super(message, { status: 422, code: 'INVALID_NISAB_CONFIGURATION' })
  }
}

export class MetalPriceUnavailableAppError extends AppError {
  constructor(message = 'De metaalprijs kon niet worden bepaald.') {
    super(message, { status: 503, code: 'METAL_PRICE_UNAVAILABLE' })
  }
}

export class ExchangeRateUnavailableAppError extends AppError {
  constructor(message = 'Een benodigde wisselkoers kon niet worden bepaald.') {
    super(message, { status: 503, code: 'EXCHANGE_RATE_UNAVAILABLE' })
  }
}

export class RuleSetNotFoundError extends AppError {
  constructor(message = 'De gevraagde Zakat-regelset bestaat niet.') {
    super(message, { status: 404, code: 'RULESET_NOT_FOUND' })
  }
}

export class CalculationAlreadyFinalizedError extends AppError {
  constructor(
    message = 'Deze berekening is al afgerond en kan niet meer gewijzigd worden. Start een nieuwe berekening.',
  ) {
    super(message, { status: 409, code: 'CALCULATION_ALREADY_FINALIZED' })
  }
}

export class CalculationIncompleteError extends AppError {
  readonly missing: string[]

  constructor(missing: string[], message = 'De berekening is nog niet compleet.') {
    super(message, { status: 422, code: 'CALCULATION_INCOMPLETE' })
    this.missing = missing
  }
}
