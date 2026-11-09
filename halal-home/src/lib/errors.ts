/**
 * Applicatiefouten met een HTTP-status.
 *
 * Eén hiërarchie, omdat de API-handler dan één `catch` heeft in plaats van per
 * route te raden welke vorm een fout heeft. Alles wat geen `AppError` is, is per
 * definitie onverwacht en wordt naar buiten toe een generieke 500 — een
 * databasefout mag nooit als tekst bij de gebruiker belanden.
 */

export class AppError extends Error {
  readonly status: number
  readonly code: string
  /** Extra context voor de client. Nooit secrets, nooit documentinhoud. */
  readonly details?: unknown

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message)
    this.name = new.target.name
    this.status = status
    this.code = code
    this.details = details
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Ongeldige invoer', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Je bent niet ingelogd') {
    super(message, 401, 'UNAUTHENTICATED')
  }
}

/**
 * Bewust een aparte fout van NotFoundError, maar de API-laag mag ze naar buiten
 * toe gelijk behandelen: wie niet bij een resource mag, hoort niet te kunnen
 * afleiden dát hij bestaat. Zie `toApiError`.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Geen toegang') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Niet gevonden') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details)
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Te veel verzoeken. Probeer het zo opnieuw.') {
    super(message, 429, 'RATE_LIMITED')
  }
}

/** AI staat uit (`AI_ENABLED=false`) of is niet geconfigureerd. */
export class AiDisabledError extends AppError {
  constructor(message = 'De AI-assistent is niet beschikbaar in deze omgeving') {
    super(message, 503, 'AI_DISABLED')
  }
}

export class AiResponseError extends AppError {
  constructor(message = 'De AI gaf een antwoord dat we niet konden verwerken') {
    super(message, 502, 'AI_RESPONSE_INVALID')
  }
}

export class StorageError extends AppError {
  constructor(message = 'Opslagfout', details?: unknown) {
    super(message, 500, 'STORAGE_ERROR', details)
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
