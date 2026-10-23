/**
 * Minimal structured logger.
 *
 * Rules: never log personal data in the message body, never log secrets, always
 * include a context object so logs stay queryable once shipped to a drain.
 *
 * Redaction here is a safety net, not the primary control — the primary control
 * is not passing the value in the first place. It exists because a log drain is
 * a long-lived, widely-read, differently-retained copy of whatever reaches it,
 * and one careless `{ ...user }` should not be the thing that leaks a mailbox.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const minLevel: Level =
  process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development' ? 'debug' : 'info'

/**
 * Key fragments whose values must never reach the log output.
 *
 * Matched as substrings against the lower-cased key, so `stripeSecretKey`,
 * `x-api-key` and `authorizationHeader` are all caught without enumerating
 * every spelling anyone will ever invent.
 */
const REDACTED_FRAGMENTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cookie',
  'credential',
  'privatekey',
  'signature',
  'sessionid',
  // Personal content — never a log line, whatever the shape.
  'email',
  'prompt',
  'reflection',
  'ipaddress',
]

/** Exact keys that are personal but whose names are too generic to substring-match. */
const REDACTED_KEYS = new Set([
  'ip',
  'name',
  'fullname',
  'phone',
  'address',
  'body',
  'content',
  'message',
  'title',
  'note',
  'query',
  'text',
  'latitude',
  'longitude',
])

/** Anything longer than this is truncated: logs are not a place for payloads. */
const MAX_VALUE_LENGTH = 512

/** Nesting past this is replaced wholesale — an accidental `{ ...user }` deep in
 *  a context object is exactly what redaction by key name would miss. */
const MAX_DEPTH = 3

function isRedactedKey(key: string): boolean {
  // Separators are stripped before matching, so `x-api-key`, `api_key` and
  // `apiKey` are all caught by the single `apikey` fragment.
  const normalised = key.toLowerCase().replace(/[^a-z]/g, '')

  if (REDACTED_KEYS.has(normalised)) return true
  return REDACTED_FRAGMENTS.some((fragment) => normalised.includes(fragment))
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…[truncated]` : value
  }

  if (typeof value !== 'object') return value

  // Deep structures are where accidental dumps hide; stop rather than walk far.
  if (depth >= MAX_DEPTH) return '[depth-limited]'

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1))
  }

  if (value instanceof Date) return value.toISOString()

  return redact(value as LogContext, depth + 1)
}

function redact(context: LogContext, depth = 0): LogContext {
  const out: LogContext = {}
  for (const [key, value] of Object.entries(context)) {
    out[key] = isRedactedKey(key) ? '[redacted]' : redactValue(value, depth)
  }
  return out
}

/** Exposed so tests can assert the policy directly rather than through console. */
export const __redactForTest = redact

function emit(level: Level, message: string, context?: LogContext) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? redact(context) : {}),
  }

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext & { error?: unknown }) => {
    const { error, ...rest } = context ?? {}
    emit('error', message, {
      ...rest,
      ...(error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : error !== undefined
          ? { error: String(error) }
          : {}),
    })
  },
}
