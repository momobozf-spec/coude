import pino from 'pino'

/**
 * Structured logging with hard redaction of sensitive fields (ADR 0003).
 *
 * Anything matching REDACTED_KEYS is replaced before it can reach a log sink,
 * at any nesting depth. There is a unit test that pushes an IBAN through this
 * logger and asserts the digits never appear in the output.
 */

const REDACTED_KEYS = [
  'iban',
  'ibanEncrypted',
  'iban_encrypted',
  'mobib',
  'mobibNumber',
  'mobib_number',
  'mobibNumberEncrypted',
  'mobib_number_encrypted',
  'encryptionKey',
  'ENCRYPTION_KEY',
  'password',
  'authorization',
  'cookie',
  'serviceRoleKey',
  'SUPABASE_SERVICE_ROLE_KEY',
  'stripeSecretKey',
  'client_secret',
] as const

/** pino needs explicit paths; cover top level plus the wrappers we actually use. */
const redactPaths = REDACTED_KEYS.flatMap((k) => [
  k,
  `*.${k}`,
  `*.*.${k}`,
  `req.headers.${k}`,
  `claim.${k}`,
  `profile.${k}`,
])

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'railclaim' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    !isProduction && !isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
})

/**
 * Belt-and-braces scrubbing for free-text that may embed an IBAN or MoBIB number
 * (error messages, third-party payloads). Used by the Sentry beforeSend hook.
 */
export function scrubText(input: string): string {
  return input
    // IBAN: 2 letters + 2 digits + 10-30 alphanumerics, optionally space-grouped
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,4}\b/g, '[REDACTED_IBAN]')
    // Long digit runs (MoBIB card numbers are 10+ digits)
    .replace(/\b\d{10,}\b/g, '[REDACTED_NUMBER]')
}

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}
