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

  if (!env.LEGAL_ENTITY_NAME || !env.LEGAL_ENTITY_VAT || !env.LEGAL_ENTITY_ADDRESS || !env.LEGAL_CONTACT_EMAIL) {
    warnings.push('LEGAL_ENTITY_* / LEGAL_CONTACT_EMAIL incomplete: the legal pages cannot name the operator')
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
