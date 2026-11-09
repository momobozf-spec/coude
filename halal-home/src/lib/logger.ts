/**
 * Gestructureerd loggen zonder afhankelijkheid: Next draait deze code zowel in
 * Node als in de edge runtime, en de meeste loggers werken niet in beide.
 *
 * BELANGRIJK — wat er NIET in een logregel hoort:
 *   - documentinhoud of bestandsnamen die een gebruiker koos;
 *   - e-mailadressen, rijksregisternummers, adressen;
 *   - API-keys, tokens, wachtwoorden, storage keys.
 *
 * Log id's en typen. `redact()` hieronder haalt de bekende gevoelige sleutels
 * eruit, maar dat is een vangnet en geen vergunning om ze mee te geven.
 */
import { env } from '@/config/env'

type Level = 'error' | 'warn' | 'info' | 'debug'

const LEVEL_ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 }

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'storagekey',
  'email',
  'content',
  'body',
])

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(val, depth + 1)
  }
  return out
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] > LEVEL_ORDER[env.LOG_LEVEL]) return

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  }

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
}
