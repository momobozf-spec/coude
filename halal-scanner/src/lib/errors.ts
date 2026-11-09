/**
 * Typed applicatiefouten.
 *
 * Elke fout draagt een stabiele `code` die de API-laag naar HTTP vertaalt.
 * Handlers hoeven daardoor niet op foutteksten te matchen, en de client krijgt
 * een code waar hij op kan programmeren.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_BARCODE"
  | "PRODUCT_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR";

const HTTP_STATUS: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_BARCODE: 400,
  PRODUCT_NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_RATE_LIMITED: 429,
  RATE_LIMITED: 429,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Extra context voor de client. Mag nooit secrets bevatten. */
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = options?.details;
  }
}

/** Externe productbron reageert niet, te traag, of met een serverfout. */
export class ProviderError extends AppError {
  readonly providerName: string;

  constructor(
    providerName: string,
    code: Extract<
      AppErrorCode,
      "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "PROVIDER_RATE_LIMITED"
    >,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(code, message, options);
    this.name = "ProviderError";
    this.providerName = providerName;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Maakt van een willekeurige `catch`-waarde een veilige logregel: nooit de
 * volledige error-object-serialisatie (die kan headers of URL's met tokens
 * bevatten), alleen naam en boodschap.
 */
export function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: String(error) };
}
