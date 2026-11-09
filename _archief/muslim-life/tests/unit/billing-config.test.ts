import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Configuration behaviour for both integrations.
 *
 * These reset module state between cases because provider resolution is cached —
 * that cache is the thing being tested.
 */

/**
 * Each case calls `vi.resetModules()` and re-imports the whole payments/AI
 * module graph. That is genuinely slow on a cold worker — well past the 5s
 * default — so the budget is raised here. The assertions are unchanged.
 */
vi.setConfig({ testTimeout: 30_000 })

const ORIGINAL_ENV = { ...process.env }

async function freshModules() {
  vi.resetModules()
  return {
    payments: await import('@/server/integrations/payments'),
    ai: await import('@/server/integrations/ai'),
    pricing: await import('@/server/modules/billing/pricing'),
  }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  // Minimum viable env so `serverEnv()` validates.
  process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db'
  process.env.AUTH_SECRET = 'a'.repeat(40)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('AI provider configuration', () => {
  it('uses the mock when explicitly selected', async () => {
    process.env.AI_PROVIDER = 'mock'
    vi.stubEnv('NODE_ENV', 'development')

    const { ai } = await freshModules()
    const status = ai.getAiStatus()

    expect(status.configured).toBe(true)
    if (status.configured) expect(status.isMock).toBe(true)
    expect(() => ai.getAiProvider()).not.toThrow()
  })

  it('fails when anthropic is named without a key', async () => {
    // The correction from Phase 4: no silent fallback to mock.
    process.env.AI_PROVIDER = 'anthropic'
    delete process.env.ANTHROPIC_API_KEY

    const { ai } = await freshModules()
    const status = ai.getAiStatus()

    expect(status.configured).toBe(false)
    if (!status.configured) expect(status.reason).toBe('MISSING_API_KEY')
    expect(() => ai.getAiProvider()).toThrow(/no API key/i)
  })

  it('fails when openai is named without a key', async () => {
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY

    const { ai } = await freshModules()

    expect(ai.isAiConfigured()).toBe(false)
    expect(() => ai.getAiProvider()).toThrow(/no API key/i)
  })

  it('configures anthropic when a key is present', async () => {
    process.env.AI_PROVIDER = 'anthropic'
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.ANTHROPIC_MODEL = 'claude-test'

    const { ai } = await freshModules()
    const status = ai.getAiStatus()

    expect(status.configured).toBe(true)
    if (status.configured) {
      expect(status.providerId).toBe('anthropic')
      expect(status.model).toBe('claude-test')
      expect(status.isMock).toBe(false)
    }
    expect(ai.isLiveProvider()).toBe(true)
  })

  it('refuses the mock in production without an explicit opt-in', async () => {
    process.env.AI_PROVIDER = 'mock'
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.ALLOW_MOCK_AI_IN_PRODUCTION

    const { ai } = await freshModules()
    const status = ai.getAiStatus()

    expect(status.configured).toBe(false)
    if (!status.configured) expect(status.reason).toBe('MOCK_NOT_ALLOWED_IN_PRODUCTION')
    expect(() => ai.getAiProvider()).toThrow(/production/i)
  })

  it('allows the mock in production when explicitly opted in', async () => {
    process.env.AI_PROVIDER = 'mock'
    vi.stubEnv('NODE_ENV', 'production')
    process.env.ALLOW_MOCK_AI_IN_PRODUCTION = 'true'

    const { ai } = await freshModules()

    expect(ai.isAiConfigured()).toBe(true)
    expect(ai.isLiveProvider()).toBe(false)
  })
})

describe('payment provider configuration', () => {
  it('uses the stub by default in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.PAYMENTS_PROVIDER

    const { payments } = await freshModules()
    const status = payments.getPaymentsStatus()

    expect(status.configured).toBe(true)
    if (status.configured) expect(status.isStub).toBe(true)
    expect(payments.isLivePayments()).toBe(false)
  })

  it('fails when stripe is named without a secret key', async () => {
    process.env.PAYMENTS_PROVIDER = 'stripe'
    delete process.env.STRIPE_SECRET_KEY

    const { payments } = await freshModules()
    const status = payments.getPaymentsStatus()

    expect(status.configured).toBe(false)
    if (!status.configured) expect(status.reason).toBe('MISSING_SECRET_KEY')
    expect(() => payments.getPaymentProvider()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('fails when stripe has a key but no prices', async () => {
    // Nothing to sell is a configuration error, and failing here beats failing
    // halfway through someone's checkout.
    process.env.PAYMENTS_PROVIDER = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    delete process.env.STRIPE_PRICE_PREMIUM_MONTHLY
    delete process.env.STRIPE_PRICE_PREMIUM_YEARLY

    const { payments } = await freshModules()
    const status = payments.getPaymentsStatus()

    expect(status.configured).toBe(false)
    if (!status.configured) expect(status.reason).toBe('MISSING_PRICES')
  })

  it('configures stripe when key and prices are present', async () => {
    process.env.PAYMENTS_PROVIDER = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_monthly'
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = 'price_yearly'

    const { payments } = await freshModules()
    const status = payments.getPaymentsStatus()

    expect(status.configured).toBe(true)
    if (status.configured) {
      expect(status.providerId).toBe('stripe')
      expect(status.isStub).toBe(false)
    }
    expect(payments.isLivePayments()).toBe(true)
  })

  it('refuses the stub in production without an explicit opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.PAYMENTS_PROVIDER = 'stub'
    delete process.env.ALLOW_STUB_PAYMENTS_IN_PRODUCTION

    const { payments } = await freshModules()
    const status = payments.getPaymentsStatus()

    expect(status.configured).toBe(false)
    if (!status.configured) expect(status.reason).toBe('STUB_NOT_ALLOWED_IN_PRODUCTION')
    expect(() => payments.getPaymentProvider()).toThrow(/production/i)
  })

  it('allows the stub in production when explicitly opted in', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.PAYMENTS_PROVIDER = 'stub'
    process.env.ALLOW_STUB_PAYMENTS_IN_PRODUCTION = 'true'

    const { payments } = await freshModules()
    expect(payments.isPaymentsConfigured()).toBe(true)
  })
})

describe('price mapping', () => {
  it('resolves both intervals in stub mode', async () => {
    process.env.PAYMENTS_PROVIDER = 'stub'
    vi.stubEnv('NODE_ENV', 'development')

    const { pricing } = await freshModules()

    const monthly = pricing.resolvePrice('PREMIUM', 'MONTHLY')
    const yearly = pricing.resolvePrice('PREMIUM', 'YEARLY')

    expect(monthly.ok).toBe(true)
    expect(yearly.ok).toBe(true)
  })

  it('maps a configured stripe price back to a plan', async () => {
    process.env.PAYMENTS_PROVIDER = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_live_monthly'
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = 'price_live_yearly'

    const { pricing } = await freshModules()
    const resolved = pricing.resolvePriceId('price_live_yearly')

    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(resolved.price.plan).toBe('PREMIUM')
      expect(resolved.price.interval).toBe('YEARLY')
    }
  })

  it('fails closed on an unknown price', async () => {
    // The critical property: any other price on the Stripe account — including
    // a €0 test price someone created — must not confer a plan.
    process.env.PAYMENTS_PROVIDER = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_live_monthly'
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = 'price_live_yearly'

    const { pricing } = await freshModules()

    for (const candidate of ['price_someone_elses', 'price_free_test', '', null, undefined]) {
      const resolved = pricing.resolvePriceId(candidate)
      expect(resolved.ok, String(candidate)).toBe(false)
      if (!resolved.ok) expect(resolved.reason).toBe('UNKNOWN_PRICE')
    }
  })

  it('marks an interval unavailable when its price is missing', async () => {
    process.env.PAYMENTS_PROVIDER = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_live_monthly'
    delete process.env.STRIPE_PRICE_PREMIUM_YEARLY

    const { pricing } = await freshModules()
    const publicPricing = pricing.getPublicPricing()

    expect(publicPricing.find((p) => p.interval === 'MONTHLY')?.available).toBe(true)
    expect(publicPricing.find((p) => p.interval === 'YEARLY')?.available).toBe(false)
  })

  it('shows the same amounts checkout will use', async () => {
    process.env.PAYMENTS_PROVIDER = 'stub'
    vi.stubEnv('NODE_ENV', 'development')

    const { pricing } = await freshModules()
    const { PRICING } = await import('@/config/plans')

    const publicPricing = pricing.getPublicPricing()
    const monthly = publicPricing.find((p) => p.interval === 'MONTHLY')

    // Display price and charged price come from one source, so they cannot drift.
    expect(monthly?.amount).toBe(PRICING.monthly.amount)
    expect(monthly?.currency).toBe(PRICING.currency)
  })
})
