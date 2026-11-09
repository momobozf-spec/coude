/**
 * Environment validation.
 *
 * Draait één keer bij het importeren, dus een ontbrekende of onzinnige waarde
 * laat de applicatie falen bij het opstarten in plaats van bij de eerste
 * request om drie uur 's nachts.
 *
 * Conditionele eisen (een API-key is alleen verplicht voor de gekozen provider)
 * staan in de refinements onderaan — niet als `.optional()` met een `!`
 * verderop in de code.
 *
 * SERVER-ONLY. Dit bestand leest secrets uit `process.env` en mag nooit in een
 * clientbundle terechtkomen. Client-side configuratie staat in
 * `src/config/public.ts`.
 */
import 'server-only'
import { z } from 'zod'

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')

const csv = z.string().transform((v) =>
  v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)

/**
 * Een optionele waarde waarbij een lege string telt als "niet ingevuld".
 *
 * Zonder dit faalt de validatie op een `.env` die uit `.env.example` is
 * gekopieerd: daar staat `ANTHROPIC_API_KEY=` met een lege waarde, en dat is
 * een aanwezige sleutel met een lege string — niet hetzelfde als afwezig.
 * Iedereen die de instructies volgt zou dan een crash krijgen bij het opstarten.
 */
const optionalString = z
  .string()
  .transform((v) => (v.trim() === '' ? undefined : v))
  .optional()

/** Zelfde, maar met een minimumlengte zodra er wél iets staat. */
const optionalSecret = (minLength: number) =>
  optionalString.refine((v) => v === undefined || v.length >= minLength, {
    message: `moet minstens ${minLength} tekens hebben wanneer hij ingevuld is`,
  })

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().min(1),

    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),

    // ── Auth ────────────────────────────────────────────────────────────────
    // 32 tekens is geen willekeurige ondergrens: korter dan dat is een
    // sessiecookie-sleutel realistisch te brute-forcen.
    AUTH_SECRET: z.string().min(32),
    AUTH_TRUST_HOST: booleanish.default(true),

    // ── AI ──────────────────────────────────────────────────────────────────
    AI_ENABLED: booleanish.default(false),
    AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
    AI_MODEL: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
    AI_MAX_VALIDATION_RETRIES: z.coerce.number().int().min(0).max(3).default(1),

    // ── Storage ─────────────────────────────────────────────────────────────
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('.storage'),
    STORAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024)
      .default(10 * 1024 * 1024),
    STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
    STORAGE_SIGNING_SECRET: optionalSecret(32),

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY: optionalString,
    S3_SECRET_KEY: optionalString,

    // ── Places ──────────────────────────────────────────────────────────────
    PLACES_PROVIDER: z.enum(['none', 'fixture', 'overpass']).default('fixture'),
    PLACES_API_KEY: optionalString,
    PLACES_CACHE_TTL_HOURS: z.coerce.number().int().positive().max(8760).default(168),

    // ── Vastgoedbronnen ─────────────────────────────────────────────────────
    PROPERTY_SOURCES: csv.default(['fixture']),
    PROPERTY_SOURCE_USER_AGENT: z
      .string()
      .min(10)
      .default('HalalHomeBot/0.1 (+https://example.com/contact)'),
    PROPERTY_SOURCE_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(120).default(20),
    PROPERTY_SOURCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
    PROPERTY_SOURCE_MAX_RESULTS_PER_RUN: z.coerce.number().int().positive().max(1000).default(100),

    // ── E-mail ──────────────────────────────────────────────────────────────
    EMAIL_PROVIDER: z.enum(['none', 'resend']).default('none'),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,

    // ── Seed ────────────────────────────────────────────────────────────────
    SEED_USER_EMAIL: z.string().email().default('dev@halalhome.local'),
    SEED_USER_PASSWORD: z.string().min(8).default('halalhome123'),
    SEED_USER_NAME: z.string().min(1).default('Mohamed'),
  })
  .superRefine((e, ctx) => {
    const require = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: 'custom', path: [path], message })
    }

    if (e.AI_ENABLED) {
      require(Boolean(e.AI_MODEL), 'AI_MODEL', 'verplicht wanneer AI_ENABLED=true')
      if (e.AI_PROVIDER === 'anthropic') {
        require(
          Boolean(e.ANTHROPIC_API_KEY),
          'ANTHROPIC_API_KEY',
          'verplicht wanneer AI_PROVIDER=anthropic en AI_ENABLED=true',
        )
      } else {
        require(
          Boolean(e.OPENAI_API_KEY),
          'OPENAI_API_KEY',
          'verplicht wanneer AI_PROVIDER=openai en AI_ENABLED=true',
        )
      }
    }

    if (e.STORAGE_PROVIDER === 'local') {
      require(
        Boolean(e.STORAGE_SIGNING_SECRET),
        'STORAGE_SIGNING_SECRET',
        'verplicht wanneer STORAGE_PROVIDER=local — zonder signeersleutel zijn download-tokens vervalsbaar',
      )
    }

    if (e.STORAGE_PROVIDER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const) {
        require(Boolean(e[key]), key, 'verplicht wanneer STORAGE_PROVIDER=s3')
      }
    }

    if (e.EMAIL_PROVIDER === 'resend') {
      require(Boolean(e.RESEND_API_KEY), 'RESEND_API_KEY', 'verplicht wanneer EMAIL_PROVIDER=resend')
      require(Boolean(e.EMAIL_FROM), 'EMAIL_FROM', 'verplicht wanneer EMAIL_PROVIDER niet none is')
    }

    if (e.PLACES_PROVIDER === 'overpass' && e.NODE_ENV === 'production') {
      require(
        e.PROPERTY_SOURCE_USER_AGENT.length > 10,
        'PROPERTY_SOURCE_USER_AGENT',
        'Overpass eist een identificeerbare user-agent met contactgegevens',
      )
    }
  })

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    // Geen throw met de ruwe Zod-error: die bevat de ingelezen waarden, en dat
    // zijn precies de secrets die we niet in een stacktrace willen hebben.
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    )
    throw new Error(
      `Ongeldige environment-configuratie:\n${lines.join('\n')}\n\nZie .env.example.`,
    )
  }
  return parsed.data
}

export const env: Env = loadEnv()

export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'
