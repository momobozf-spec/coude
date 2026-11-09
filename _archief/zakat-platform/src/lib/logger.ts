type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? 'info') as Level
  return LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info
}

/**
 * Keys whose values are financial or otherwise sensitive and must never be
 * written to logs (§45, §47). Amounts belong in the database, not in stdout.
 */
const REDACT = new Set([
  'amount',
  'value',
  'balance',
  'netWealth',
  'grossAssets',
  'zakatDue',
  'nisabValue',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'iban',
  'reference',
  'email',
])

function redact(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(context)) {
    out[key] = REDACT.has(key) ? '[redacted]' : val
  }
  return out
}

function emit(level: Level, event: string, context?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < threshold()) return

  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...(context ? redact(context) : {}),
  }

  const serialized = JSON.stringify(line)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.log(serialized)
}

/**
 * Structured logger. Log *events* with a dotted name, not sentences — they are
 * grepped and counted, not read as prose.
 */
export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => emit('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => emit('info', event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit('warn', event, context),
  error: (event: string, context?: Record<string, unknown>) => emit('error', event, context),
}

/** Exposed for tests. */
export const REDACTED_KEYS = REDACT
