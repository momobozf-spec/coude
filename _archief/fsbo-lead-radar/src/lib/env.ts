import { z } from 'zod'

/**
 * Eén plek waar de omgeving gelezen én gevalideerd wordt.
 *
 * Waarom validatie in plaats van `process.env.X ?? default` op de call-site:
 * een verkeerd getypte drempel (`PRIVATE_CONFIDENCE_THRESHOLD="85"` in plaats
 * van `"0.85"`) zou anders pas opvallen wanneer élke advertentie als lead
 * doorgaat. Hier faalt de start.
 *
 * Secrets komen uitsluitend hiervandaan. Nergens in de broncode staat een
 * token, wachtwoord of connectiestring.
 */

/** Komma-gescheiden lijst → array zonder lege elementen. */
const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  )

const numeric = (fallback: number): z.ZodType<number> =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? fallback : Number(value)))
    .pipe(z.number().finite())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL ontbreekt'),

  // Admin. In productie moeten deze echt gezet zijn; zie `assertProductionSecrets`.
  ADMIN_PASSWORD: z.string().default(''),
  SESSION_SECRET: z.string().default(''),
  SESSION_TTL_HOURS: numeric(12).pipe(z.number().int().positive()),

  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_FALLBACK_CHAT_ID: z.string().default(''),

  PRIVATE_CONFIDENCE_THRESHOLD: numeric(0.85).pipe(z.number().min(0).max(1)),
  MIN_LEAD_SCORE: numeric(55).pipe(z.number().int().min(0).max(100)),
  DUPLICATE_CONFIDENCE_THRESHOLD: numeric(0.72).pipe(z.number().min(0).max(1)),
  PROFESSIONAL_LISTING_COUNT_THRESHOLD: numeric(4).pipe(z.number().int().min(1)),

  COLLECTOR_ENABLED_SOURCES: csv,
  COLLECTOR_USER_AGENT: z
    .string()
    .default('FsboLeadRadarBot/0.1 (+https://example.be/bot; contact@example.be)'),
  COLLECTOR_MAX_REQUESTS_PER_MINUTE: numeric(20).pipe(z.number().int().positive()),
  COLLECTOR_HTTP_TIMEOUT_MS: numeric(15_000).pipe(z.number().int().positive()),
  COLLECTOR_COOLDOWN_MINUTES: numeric(30).pipe(z.number().int().positive()),
  COLLECTOR_CONCURRENCY: numeric(3).pipe(z.number().int().positive().max(32)),

  RETENTION_LISTING_DAYS: numeric(90).pipe(z.number().int().min(0)),
  RETENTION_RAW_PAYLOAD_DAYS: numeric(14).pipe(z.number().int().min(0)),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CRON_SECRET: z.string().default(''),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Ongeldige omgevingsvariabelen:\n${details}`)
  }

  return result.data
}

export function getEnv(): Env {
  cached ??= parseEnv()
  return cached
}

/** Alleen voor tests: dwingt een herlezing na het aanpassen van process.env. */
export function resetEnvCache(): void {
  cached = null
}

/**
 * Harde eis in productie: zonder deze twee is het dashboard open of het
 * sessiecookie vervalsbaar. In development mag het ontbreken, dan draait de
 * admin in een expliciet gemarkeerde onbeveiligde modus.
 */
export function assertProductionSecrets(env: Env = getEnv()): void {
  if (env.NODE_ENV !== 'production') return

  const missing: string[] = []
  if (env.ADMIN_PASSWORD.length < 12) missing.push('ADMIN_PASSWORD (minstens 12 tekens)')
  if (env.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET (minstens 32 tekens)')

  if (missing.length > 0) {
    throw new Error(`Productie vereist: ${missing.join(', ')}`)
  }
}

/** Staat de admin zonder wachtwoord open? Alleen mogelijk buiten productie. */
export function isAdminAuthConfigured(env: Env = getEnv()): boolean {
  return env.ADMIN_PASSWORD.length > 0 && env.SESSION_SECRET.length >= 32
}
