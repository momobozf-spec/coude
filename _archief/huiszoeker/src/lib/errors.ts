/**
 * Getypeerde domeinfouten.
 *
 * Eén regel: een fout die de client mag zien is een `AppError` met een stabiele
 * `code`. Alles wat géén AppError is — een Prisma-fout, een TypeError, een
 * netwerkfout — wordt door de errorHandler een generieke 500 met een
 * request-id. Zo lekt er nooit een databasestructuur of stacktrace naar buiten,
 * en hoeft niemand daar per endpoint aan te denken.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "SEARCH_NOT_FOUND"
  | "SEARCH_NAME_TAKEN"
  | "SEARCH_ALREADY_RUNNING"
  | "SEARCH_INACTIVE"
  | "USER_NOT_FOUND"
  | "PROPERTY_NOT_FOUND"
  | "AI_DISABLED"
  | "AI_PARSE_FAILED"
  | "AI_UNAVAILABLE"
  | "SOURCE_BLOCKED"
  | "SOURCE_UNAVAILABLE"
  | "ROBOTS_DISALLOWED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  /** Extra context voor de client. Bevat nooit secrets of ruwe DB-velden. */
  readonly details?: unknown;

  constructor(code: ErrorCode, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "De invoer is ongeldig", details?: unknown) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, 409, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Niet geauthenticeerd") {
    super("UNAUTHORIZED", 401, message);
  }
}

/** De AI-provider staat uit (`AI_ENABLED=false`) of mist configuratie. */
export class AiDisabledError extends AppError {
  constructor(message = "AI staat uit; lever gestructureerde criteria aan in plaats van vrije tekst") {
    super("AI_DISABLED", 503, message);
  }
}

/** Het model gaf iets terug dat niet door het schema kwam, ook na een retry. */
export class AiParseError extends AppError {
  constructor(message: string, details?: unknown) {
    super("AI_PARSE_FAILED", 422, message, details);
  }
}

/** De provider zelf faalde (netwerk, rate limit, 5xx). */
export class AiUnavailableError extends AppError {
  constructor(message: string) {
    super("AI_UNAVAILABLE", 503, message);
  }
}

/** robots.txt verbiedt dit pad. Geen retry, geen omweg. */
export class RobotsDisallowedError extends AppError {
  constructor(url: string) {
    super("ROBOTS_DISALLOWED", 403, `robots.txt verbiedt deze URL: ${url}`);
  }
}

/** De bron blokkeert ons (403, challenge). De bron gaat in cooldown. */
export class SourceBlockedError extends AppError {
  readonly source: string;
  constructor(source: string, message: string) {
    super("SOURCE_BLOCKED", 502, message);
    this.source = source;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
