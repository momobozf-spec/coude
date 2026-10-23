import type { Feature } from '@/config/plans'

/**
 * Domain errors. Route handlers map these to status codes in one place
 * (`src/server/http/respond.ts`) so no handler invents its own contract.
 */

export class AppError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, options: { status: number; code: string }) {
    super(message)
    this.name = new.target.name
    this.status = options.status
    this.code = options.code
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Je moet ingelogd zijn.') {
    super(message, { status: 401, code: 'UNAUTHENTICATED' })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Je hebt geen toegang tot dit item.') {
    super(message, { status: 403, code: 'FORBIDDEN' })
  }
}

/**
 * Thrown when a record exists but belongs to somebody else.
 *
 * Deliberately reports 404, not 403: telling a caller "this exists but is not
 * yours" leaks that another user holds that id (§46).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Niet gevonden.') {
    super(message, { status: 404, code: 'NOT_FOUND' })
  }
}

export class ValidationError extends AppError {
  readonly issues: Record<string, string[]>

  constructor(message = 'De ingevoerde gegevens kloppen niet.', issues: Record<string, string[]> = {}) {
    super(message, { status: 422, code: 'VALIDATION_ERROR' })
    this.issues = issues
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Dit item bestaat al.') {
    super(message, { status: 409, code: 'CONFLICT' })
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number, message = 'Te veel verzoeken. Probeer het straks opnieuw.') {
    super(message, { status: 429, code: 'RATE_LIMITED' })
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Raised by the entitlement service; carries what to upsell (§44). */
export class EntitlementError extends AppError {
  readonly feature: Feature | null
  readonly limitKey: string | null
  readonly requiredPlan: string | null

  constructor(
    message: string,
    details: { feature?: Feature; limitKey?: string; requiredPlan?: string | null } = {},
  ) {
    super(message, { status: 402, code: 'UPGRADE_REQUIRED' })
    this.feature = details.feature ?? null
    this.limitKey = details.limitKey ?? null
    this.requiredPlan = details.requiredPlan ?? null
  }
}

/** Attempt to change a finalised snapshot (§13). */
export class ImmutableRecordError extends AppError {
  constructor(message = 'Een afgeronde berekening kan niet meer gewijzigd worden.') {
    super(message, { status: 409, code: 'IMMUTABLE' })
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
