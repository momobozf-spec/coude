import { z } from 'zod'

/**
 * Environment configuration, validated once at module load.
 *
 * Server variables are only readable from server code. Importing this module from a
 * client component will fail the build via the `server-only` guard in consumers.
 * Public values live in `publicEnv` and are the only ones safe to reach the browser.
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
  /** Fallback model when no provider-specific one is set. */
  AI_MODEL: z.string().default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  /** Any OpenAI-compatible endpoint: Azure, Together, Groq, a local vLLM. */
  OPENAI_BASE_URL: z.string().url().optional(),
  /**
   * Opt-in to the mock assistant in production, for preview/demo deployments.
   * Without it, `AI_PROVIDER=mock` fails closed in production rather than
   * quietly serving canned replies as if a real model were connected.
   */
  ALLOW_MOCK_AI_IN_PRODUCTION: z
    .string()
    .transform((value) => value === 'true')
    .optional(),

  // ── Payments ──────────────────────────────────────────────────────────────
  PAYMENTS_PROVIDER: z.enum(['stripe', 'stub']).default('stub'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Price IDs are never hardcoded — they come from here and are mapped server-side. */
  STRIPE_PRICE_PREMIUM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PREMIUM_YEARLY: z.string().optional(),
  /** Same fail-closed rule as the assistant: no fake billing in production. */
  ALLOW_STUB_PAYMENTS_IN_PRODUCTION: z
    .string()
    .transform((value) => value === 'true')
    .optional(),

  // ── Analytics ─────────────────────────────────────────────────────────────
  /**
   * `database` is the default on purpose: events stay in our own Postgres, in
   * the same region as everything else, and no third party is contacted unless
   * someone deliberately configures one.
   */
  ANALYTICS_PROVIDER: z.enum(['noop', 'console', 'database', 'posthog']).default('database'),

  // ── Notifications ─────────────────────────────────────────────────────────
  /**
   * `stub` records the delivery without sending anything. There is no live
   * email or push provider yet, and pretending otherwise would make the
   * delivery table lie.
   */
  NOTIFICATIONS_PROVIDER: z.enum(['stub', 'console']).default('stub'),

  // ── Operations ────────────────────────────────────────────────────────────
  /**
   * Comma-separated origins allowed to make state-changing requests, on top of
   * `NEXT_PUBLIC_APP_URL`. Needed when the app is reachable on more than one
   * hostname (apex + www, a preview domain).
   */
  ALLOWED_ORIGINS: z.string().optional(),
  /** Shared secret for the readiness endpoint's detailed output. */
  HEALTH_CHECK_TOKEN: z.string().optional(),
})

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_MAPS_PROVIDER: z.enum(['none', 'google', 'mapbox']).default('none'),
  NEXT_PUBLIC_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
})

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when referenced
 * statically, so these must be written out literally rather than looped over.
 */
const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_MAPS_PROVIDER: process.env.NEXT_PUBLIC_MAPS_PROVIDER,
  NEXT_PUBLIC_MAPS_API_KEY: process.env.NEXT_PUBLIC_MAPS_API_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
})

if (!publicParsed.success) {
  throw new Error(`Invalid public environment configuration:\n${formatIssues(publicParsed.error)}`)
}

export const publicEnv = publicParsed.data

let cachedServerEnv: z.infer<typeof serverSchema> | null = null

/**
 * Lazily validated so that importing shared modules from the client never trips
 * server-only validation. Call this from server code only.
 */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration:\n${formatIssues(parsed.error)}`)
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}

export const isProduction = process.env.NODE_ENV === 'production'
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isTest = process.env.NODE_ENV === 'test'
