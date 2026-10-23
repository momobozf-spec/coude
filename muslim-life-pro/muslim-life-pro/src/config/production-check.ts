/**
 * Start-up check of the production configuration.
 *
 * Errors are configurations that would run insecurely or silently broken; the
 * server refuses to start with them. Warnings switch a feature off and are
 * logged so they cannot go unnoticed.
 */
export interface EnvReport {
  errors: string[]
  warnings: string[]
}

function isHttps(value: string | undefined): boolean {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** Example secrets from docs and tutorials that must never reach production. */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'change-me',
  'secret',
  'your-secret',
  'your_secret_here',
  'supersecret',
  'dummysecretdummysecretdummysecret12',
  // The value shipped in .env.example: long enough to pass the length check.
  'replace-me-with-a-32-byte-random-string',
])

export function checkProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = []
  const warnings: string[] = []
  if (env.NODE_ENV !== 'production') return { errors, warnings }

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is missing')
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    errors.push('AUTH_SECRET is missing or shorter than 32 characters')
  }
  if (!isHttps(env.APP_URL)) {
    errors.push('APP_URL must be the https address of this deployment (checkout, password reset and origin checks use it)')
  }
  if (env.AUTH_URL && env.APP_URL && safeOrigin(env.AUTH_URL) !== safeOrigin(env.APP_URL)) {
    errors.push('AUTH_URL and APP_URL must point at the same origin')
  }

  // STAGING=1 marks a deliberate test deployment (e.g. the free Render setup).
  // Only there may the app run with fake providers, test keys or demo data.
  const staging = env.STAGING === '1'
  if (env.AUTH_SECRET && KNOWN_PLACEHOLDER_SECRETS.has(env.AUTH_SECRET.trim().toLowerCase())) {
    errors.push('AUTH_SECRET is a placeholder value: generate your own (openssl rand -base64 32)')
  }
  if (!staging) {
    if (env.ALLOW_STUB_PAYMENTS_IN_PRODUCTION === 'true') {
      errors.push('ALLOW_STUB_PAYMENTS_IN_PRODUCTION=true would hand out Premium without payment: only allowed with STAGING=1')
    }
    if (env.ALLOW_MOCK_AI_IN_PRODUCTION === 'true') {
      errors.push('ALLOW_MOCK_AI_IN_PRODUCTION=true serves canned assistant replies: only allowed with STAGING=1')
    }
    if (env.SEED_DEMO_LISTINGS === '1') {
      errors.push('SEED_DEMO_LISTINGS=1 publishes fictional listings: only allowed with STAGING=1')
    }
    if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || env.STRIPE_SECRET_KEY?.startsWith('rk_test_')) {
      errors.push('STRIPE_SECRET_KEY is a test key in production: use a live key, or set STAGING=1 for a test deployment')
    }
  }

  if (env.PAYMENTS_PROVIDER === 'stripe') {
    if (!env.STRIPE_SECRET_KEY) errors.push('PAYMENTS_PROVIDER=stripe but STRIPE_SECRET_KEY is missing')
    if (!env.STRIPE_WEBHOOK_SECRET) {
      errors.push('PAYMENTS_PROVIDER=stripe but STRIPE_WEBHOOK_SECRET is missing: no subscription would ever activate')
    }
    if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      warnings.push('STRIPE_SECRET_KEY is a test key: nobody is charged')
    }
  } else {
    warnings.push('Payments are not live (PAYMENTS_PROVIDER is not "stripe"): Premium cannot be bought')
  }

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    warnings.push('RESEND_API_KEY / EMAIL_FROM missing: password reset by e-mail is unavailable')
  } else if (/@resend\.dev>?\s*$/i.test(env.EMAIL_FROM)) {
    warnings.push('EMAIL_FROM uses resend.dev: Resend only delivers to the account owner, members get nothing')
  }

  if (!env.LEGAL_ENTITY_ADDRESS) {
    warnings.push('LEGAL_ENTITY_ADDRESS missing: the legal pages show only "Zaventem" instead of the full registered-office address')
  }
  if (!env.HEALTH_CHECK_TOKEN || env.HEALTH_CHECK_TOKEN.length < 32) {
    warnings.push('HEALTH_CHECK_TOKEN missing or short: the maintenance job (account deletions) is disabled')
  }
  if ((env.AI_PROVIDER ?? 'mock') === 'mock') {
    warnings.push(
      env.ALLOW_MOCK_AI_IN_PRODUCTION === 'true'
        ? 'AI_PROVIDER=mock: the assistant gives labelled demo replies'
        : 'AI_PROVIDER=mock without ALLOW_MOCK_AI_IN_PRODUCTION: the assistant is unavailable',
    )
  }
  if (env.TRUSTED_PROXY_HOPS === '0') {
    warnings.push('TRUSTED_PROXY_HOPS=0: client addresses are unknown, so per-IP rate limits are off (per-account limits still apply)')
  }
  if (env.SEED_DEMO_LISTINGS === '1') {
    warnings.push('SEED_DEMO_LISTINGS=1: fictional demo listings are published (badged "Demo")')
  }

  return { errors, warnings }
}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
