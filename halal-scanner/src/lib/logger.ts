/**
 * Structured logging.
 *
 * Eén regel JSON per gebeurtenis, met een vaste set eventnamen zodat er later
 * op gefilterd en gealerteerd kan worden. De logger schrijft naar stdout/stderr;
 * een log-collector in productie pikt dat op.
 *
 * Er wordt bewust GEEN vrije `unknown`-payload doorgegeven aan de output:
 * `redact()` verwijdert bekende gevoelige sleutels en kapt lange strings af,
 * zodat een externe payload of een API key niet per ongeluk in de logs belandt.
 */

export type LogEvent =
  // Product lookup (fase 2)
  | "PRODUCT_LOOKUP_STARTED"
  | "PRODUCT_CACHE_HIT"
  | "PRODUCT_CACHE_MISS"
  | "PRODUCT_PROVIDER_REQUEST"
  | "PRODUCT_PROVIDER_SUCCESS"
  | "PRODUCT_PROVIDER_FAILED"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_IMPORTED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_UNCHANGED"
  | "BARCODE_INVALID"
  | "BARCODE_NOT_FOUND"
  | "PRODUCT_SEARCH"
  // Analyse (fase 3)
  | "PRODUCT_ANALYZED"
  | "PRODUCT_ANALYSIS_REUSED"
  | "PRODUCT_ANALYSIS_STARTED"
  | "PRODUCT_ANALYSIS_CACHE_HIT"
  | "PRODUCT_ANALYSIS_REFERENCE_LOADED"
  | "PRODUCT_ANALYSIS_COMPLETED"
  | "PRODUCT_ANALYSIS_CONFLICT"
  | "PRODUCT_ANALYSIS_FAILED"
  // OCR (fase 5)
  | "OCR_STARTED"
  | "OCR_COMPLETED"
  | "OCR_FAILED"
  | "OCR_RETRIED"
  | "OCR_CONFIRMED"
  // Certificaten (fase 6)
  | "CERTIFICATE_UPLOADED"
  | "CERTIFICATE_VERIFIED"
  | "CERTIFICATE_REJECTED"
  | "CERTIFICATE_EXPIRED"
  // Community (fase 7)
  | "REVIEW_CREATED"
  | "REVIEW_VOTED"
  | "REPORT_CREATED"
  | "REPORT_RESOLVED"
  // Infrastructuur
  | "REQUEST_FAILED"
  | "RATE_LIMITED";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue = string | number | boolean | null | undefined | string[];
export type LogContext = Record<string, LogValue>;

/** Sleutels waarvan de waarde nooit in een logregel hoort. */
const SENSITIVE_KEY = /(key|token|secret|password|authorization|cookie|credential)/i;
const MAX_STRING_LENGTH = 512;

function redactValue(key: string, value: LogValue): LogValue {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...[afgekapt]`;
  }
  if (Array.isArray(value) && value.length > 25) {
    return [...value.slice(0, 25), `...[${value.length - 25} meer]`];
  }
  return value;
}

function redact(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    out[key] = redactValue(key, value);
  }
  return out;
}

export interface Logger {
  log(level: LogLevel, event: LogEvent, context?: LogContext): void;
  debug(event: LogEvent, context?: LogContext): void;
  info(event: LogEvent, context?: LogContext): void;
  warn(event: LogEvent, context?: LogContext): void;
  error(event: LogEvent, context?: LogContext): void;
  /** Geeft een logger die `base` aan elke regel toevoegt (bv. requestId). */
  child(base: LogContext): Logger;
}

function emit(level: LogLevel, event: LogEvent, context: LogContext): void {
  // In tests blijft de output uit de weg; assertions gebruiken de fake logger.
  if (process.env.NODE_ENV === "test" && !process.env.LOG_IN_TESTS) return;

  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...redact(context),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function make(base: LogContext): Logger {
  const logger: Logger = {
    log(level, event, context) {
      emit(level, event, { ...base, ...context });
    },
    debug: (event, context) => logger.log("debug", event, context),
    info: (event, context) => logger.log("info", event, context),
    warn: (event, context) => logger.log("warn", event, context),
    error: (event, context) => logger.log("error", event, context),
    child: (extra) => make({ ...base, ...extra }),
  };
  return logger;
}

export const logger: Logger = make({});

/** Correlatie-id per request. Verschijnt in elke logregel en in errorresponses. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
