import { z } from 'zod'

/**
 * Environment configuration, validated once and cached.
 *
 * `serverEnv()` is lazy so that importing a shared module from a client component
 * never trips server-only validation. `publicEnv` holds the only values that are
 * allowed to reach the browser (§46: no secrets client-side).
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Generate one with `npx auth secret`.'),
  AUTH_URL: z.string().url().optional(),

  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  AI_PROVIDER: z.enum(['anthropic', 'openai', 'mock']).default('mock'),
  AI_MODEL: z.string().default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  METAL_PRICE_PROVIDER: z.enum(['fixture', 'manual', 'metalprice', 'published']).default('fixture'),
  METAL_PRICE_API_KEY: z.string().optional(),

  FX_PROVIDER: z.enum(['fixture', 'frankfurter', 'published']).default('fixture'),
  FX_API_KEY: z.string().optional(),

  /// Ouder dan dit (in dagen) en een gepubliceerde prijs telt niet meer mee:
  /// de berekening weigert in plaats van met een verouderde nisab te rekenen.
  MAX_PRICE_AGE_DAYS: z.coerce.number().int().min(1).max(31).default(4),

  /// Automatische aanvulling van de wisselkoersen uit de ECB-referentiekoersen
  /// (via frankfurter.dev). `none` = alleen wat de beheerder publiceert.
  FX_SYNC: z.enum(['none', 'frankfurter']).default('none'),

  /// Max. databaseverbindingen per proces.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /// Inlogbeveiliging: vergrendeling per account en plafond per IP-adres.
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  LOGIN_MAX_ATTEMPTS_PER_IP: z.coerce.number().int().min(5).max(1000).default(30),
  /// Aantal reverse proxies vóór de app die X-Forwarded-For aanvullen.
  /// In productie minstens 1: zonder proxy is het bezoekers-IP niet te kennen.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

  // Juridische identiteit — verschijnt op /privacy en /voorwaarden.
  LEGAL_ENTITY_NAME: z.string().default(''),
  LEGAL_ENTITY_VAT: z.string().default(''),
  LEGAL_ENTITY_ADDRESS: z.string().default(''),
  LEGAL_CONTACT_EMAIL: z.string().default(''),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['none', 'resend']).default('none'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /// Shared secret for the reminder-processing endpoint. Unset means the
  /// endpoint refuses every request — it never defaults to open.
  CRON_SECRET: z.string().min(16).optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
}

/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when it is referenced
 * statically, so these must be written out literally rather than looped over.
 */
const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})

if (!publicParsed.success) {
  throw new Error(`Invalid public environment configuration:\n${formatIssues(publicParsed.error)}`)
}

export const publicEnv = publicParsed.data

let cached: ServerEnv | null = null

/** Validate and return server environment. Server code only. */
export function serverEnv(): ServerEnv {
  if (cached) return cached

  // Een lege waarde (`CRON_SECRET=""` uit .env.example) betekent "niet ingesteld",
  // niet "een lege string die aan de regels moet voldoen".
  const defined = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
  )
  const parsed = serverSchema.safeParse(defined)
  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration:\n${formatIssues(parsed.error)}`)
  }

  cached = parsed.data
  return cached
}

/** Test seam — lets a test validate a fabricated environment. */
export function parseServerEnv(raw: Record<string, string | undefined>) {
  return serverSchema.safeParse(raw)
}

/**
 * Wat in productie verplicht is. Wordt bij het opstarten aangeroepen
 * (src/instrumentation.ts en de worker); faalt dit, dan start het proces niet.
 *
 * De belangrijkste regel: geen ontwikkelprijzen. Een fixture-goudprijs in
 * productie levert echte mensen een verkeerd Zakat-bedrag op.
 */
export function productionProblems(env: ServerEnv, appUrl: string): string[] {
  if (env.NODE_ENV !== 'production') return []

  const problems: string[] = []

  if (env.AUTH_SECRET === 'replace-me-with-a-32-byte-random-string') {
    problems.push('AUTH_SECRET staat nog op de voorbeeldwaarde uit .env.example')
  }
  // Alleen `published` heeft een herkenbare bron per dag; fixture zijn
  // ontwikkelprijzen en metalprice/frankfurter-als-provider bestaan niet.
  if (env.METAL_PRICE_PROVIDER !== 'published') {
    problems.push(`METAL_PRICE_PROVIDER=${env.METAL_PRICE_PROVIDER} is in productie niet toegestaan (gebruik published)`)
  }
  if (env.FX_PROVIDER !== 'published') {
    problems.push(`FX_PROVIDER=${env.FX_PROVIDER} is in productie niet toegestaan (gebruik published; FX_SYNC=frankfurter vult de ECB-koersen aan)`)
  }
  if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    problems.push('E-mail is verplicht in productie (wachtwoordherstel): zet EMAIL_PROVIDER=resend, RESEND_API_KEY en EMAIL_FROM')
  }
  if (env.TRUSTED_PROXY_HOPS < 1) {
    problems.push('TRUSTED_PROXY_HOPS=0: zet de app achter een reverse proxy (TLS) en zet dit op het aantal proxies, anders delen alle bezoekers één inloglimiet')
  }
  if (env.STORAGE_PROVIDER === 's3') {
    problems.push('STORAGE_PROVIDER=s3 is nog niet geïmplementeerd; gebruik local met een persistent volume')
  }

  let url: URL | null = null
  try {
    url = new URL(appUrl)
  } catch {
    url = null
  }
  const local = url !== null && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (!url || (url.protocol !== 'https:' && !local)) {
    problems.push('NEXT_PUBLIC_APP_URL moet met https:// beginnen')
  }

  return problems
}

/**
 * De publieke URL zoals ze bij het *draaien* is ingesteld.
 *
 * `process.env.NEXT_PUBLIC_APP_URL` wordt door Next bij de build ingeplakt, ook
 * in servercode. Een image gebouwd zonder die variabele zou anders voor altijd
 * links naar http://localhost:3000 mailen. De dynamische sleutel voorkomt het
 * inplakken; serverlinks (herstelmails, downloadlinks) gebruiken dus altijd de
 * runtimewaarde.
 */
export function appBaseUrl(): string {
  const key = ['NEXT_PUBLIC', 'APP_URL'].join('_')
  const value = process.env[key] ?? publicEnv.NEXT_PUBLIC_APP_URL
  return value.replace(/\/+$/, '')
}

export function assertProductionConfig(): void {
  const problems = productionProblems(serverEnv(), appBaseUrl())
  if (problems.length > 0) {
    throw new Error(`Productieconfiguratie onvolledig:\n${problems.map((p) => `  • ${p}`).join('\n')}`)
  }
}

export const isProduction = process.env.NODE_ENV === 'production'
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isTest = process.env.NODE_ENV === 'test'
