/** Stabiele foutcodes. De client vertaalt ze naar leesbare tekst. */
export const ErrorCode = {
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  ValidationFailed: 'VALIDATION_FAILED',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  EmailInUse: 'EMAIL_IN_USE',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  TokenExpired: 'TOKEN_EXPIRED',
  TokenReused: 'TOKEN_REUSED',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  UnsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  Internal: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldError[];
    /** Bij RATE_LIMITED: aantal seconden tot de volgende poging. */
    retryAfter?: number;
    /** Correleert client-logs met serverlogs. */
    requestId?: string;
  };
}

export const HTTP_STATUS_BY_ERROR: Readonly<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EMAIL_IN_USE: 409,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_REUSED: 401,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
};
