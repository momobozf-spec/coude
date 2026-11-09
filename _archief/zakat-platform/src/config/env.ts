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

  METAL_PRICE_PROVIDER: z.enum(['fixture', 'manual', 'metalprice']).default('fixture'),
  METAL_PRICE_API_KEY: z.string().optional(),

  FX_PROVIDER: z.enum(['fixture', 'frankfurter']).default('fixture'),
  FX_API_KEY: z.string().optional(),

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

  const parsed = serverSchema.safeParse(process.env)
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

export const isProduction = process.env.NODE_ENV === 'production'
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isTest = process.env.NODE_ENV === 'test'
