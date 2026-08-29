import { z } from 'zod'

/**
 * Server-side environment. Import this ONLY from server code (route handlers,
 * server components, the worker). It throws at module load if the environment is
 * incomplete, so a misconfigured deploy fails loudly at boot instead of silently
 * degrading a claim flow.
 */

const base64Key32 = z
  .string()
  .refine((v) => {
    try {
      return Buffer.from(v, 'base64').length === 32
    } catch {
      return false
    }
  }, 'must be 32 raw bytes, base64-encoded (generate: openssl rand -base64 32)')

/** Integrations that are not yet configured resolve to `null`, never to a fake value. */
const optionalSecret = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((v) => v ?? null)

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),

  // --- Supabase -----------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  /** Bypasses RLS. Worker + admin only. Must never reach the browser. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // --- Encryptie (ADR 0003) ----------------------------------------------
  ENCRYPTION_KEY: base64Key32,

  // --- iRail fair use (docs/irail.md) ------------------------------------
  /** Goes into the User-Agent so iRail can reach us before blocking. Required. */
  IRAIL_CONTACT_EMAIL: z.string().email(),
  IRAIL_BASE_URL: z.string().url().default('https://api.irail.be/v1'),

  // --- CONFIGURATION REQUIRED -------------------------------------------
  // Fully implemented, inert until credentials are supplied. See INTEGRATIONS.md.
  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: z.string().email().optional().transform((v) => v ?? null),
  SENTRY_DSN: optionalSecret,

  /** Comma-separated list of admin e-mail addresses. */
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (cached) return cached

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment configuration:\n${detail}\n\nSee .env.example and INTEGRATIONS.md.`,
    )
  }

  cached = parsed.data
  return cached
}

/** Test-only: drop the memoised env after mutating process.env. */
export function resetEnvCache(): void {
  cached = null
}

/**
 * Feature availability, derived from which credentials are actually present.
 * The UI uses this to avoid showing a flow as working when it cannot run —
 * nothing is ever mocked to fill a gap.
 */
export function getIntegrationStatus(env: ServerEnv = getEnv()) {
  return {
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    email: Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
    sentry: Boolean(env.SENTRY_DSN),
  } as const
}
