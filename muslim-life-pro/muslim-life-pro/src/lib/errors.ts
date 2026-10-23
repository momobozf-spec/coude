/**
 * Typed application errors.
 *
 * Services throw these; the API layer maps them to responses via `toErrorResponse`.
 * Internal detail never crosses the boundary — only `code`, `message` and safe `meta`.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ENTITLEMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly meta: Record<string, unknown>
  /** Safe to show to the end user as-is. */
  readonly expose: boolean

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; meta?: Record<string, unknown>; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = code
    this.status = options.status ?? 500
    this.meta = options.meta ?? {}
    this.expose = options.expose ?? true
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The submitted data is invalid.', meta?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, { status: 400, meta })
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'You need to sign in to continue.') {
    super('UNAUTHENTICATED', message, { status: 401 })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super('FORBIDDEN', message, { status: 403 })
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} was not found.`, { status: 404 })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That conflicts with something that already exists.') {
    super('CONFLICT', message, { status: 409 })
  }
}

/** Thrown when a feature requires a plan the user does not have. */
export class EntitlementError extends AppError {
  readonly feature: string

  constructor(feature: string, message = 'This feature is part of Muslim Life Premium.') {
    super('ENTITLEMENT_REQUIRED', message, { status: 402, meta: { feature } })
    this.feature = feature
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number, message = 'Too many requests. Please try again shortly.') {
    super('RATE_LIMITED', message, { status: 429, meta: { retryAfterSeconds } })
  }
}

export class QuotaExceededError extends AppError {
  constructor(quota: string, message = 'You have reached your limit for this month.') {
    super('QUOTA_EXCEEDED', message, { status: 429, meta: { quota } })
  }
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode
    message: string
    meta?: Record<string, unknown>
  }
}

const GENERIC_MESSAGE = 'Something went wrong on our side. Please try again.'

/** Map any thrown value to a safe HTTP response body + status. */
export function toErrorResponse(error: unknown): { status: number; body: ErrorResponseBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.expose ? error.message : GENERIC_MESSAGE,
          ...(Object.keys(error.meta).length > 0 ? { meta: error.meta } : {}),
        },
      },
    }
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE } },
  }
}

/** Result shape returned by Server Actions, so forms can render errors without throwing. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; meta?: Record<string, unknown> }

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function actionError(error: unknown): ActionResult<never> {
  const { body } = toErrorResponse(error)
  return {
    ok: false,
    code: body.error.code,
    message: body.error.message,
    ...(body.error.meta ? { meta: body.error.meta } : {}),
  }
}
