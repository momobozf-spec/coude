import { describe, expect, it } from 'vitest'

import { safeCallbackPath } from '@/lib/safe-redirect'
import { clientIpFrom, trustedProxyHops } from '@/server/http/client-ip'
import { isSessionRevoked } from '@/server/auth/session-revocation'
import { checkProductionEnv } from '@/config/production-check'
import { appUrl } from '@/config/app-url'
import { legalEntity } from '@/config/legal'
import {
  invoiceSubscriptionId,
  normaliseStripeSubscription,
} from '@/server/integrations/payments/stripe/stripe-provider'
import { registerSchema } from '@/server/modules/account/account.schema'
import { PLAN_FEATURES } from '@/config/plans'

describe('safeCallbackPath', () => {
  it.each([
    ['/app/habits', '/app/habits'],
    ['/app?tab=1#x', '/app?tab=1#x'],
  ])('keeps the same-site path %s', (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected)
  })

  it.each([
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/app\nSet-Cookie: x',
    '',
    null,
  ])('falls back for %s', (input) => {
    expect(safeCallbackPath(input)).toBe('/app')
  })
})

describe('clientIpFrom', () => {
  it('ignores the spoofable left-most entry behind one proxy', () => {
    expect(clientIpFrom('6.6.6.6, 203.0.113.9', 1)).toBe('203.0.113.9')
  })

  it('takes the hop-th entry from the right', () => {
    expect(clientIpFrom('6.6.6.6, 198.51.100.1, 10.0.0.1', 2)).toBe('198.51.100.1')
  })

  it('ignores the header entirely without trusted proxies', () => {
    expect(clientIpFrom('203.0.113.9', 0)).toBe('unknown')
  })

  it('reads TRUSTED_PROXY_HOPS defensively', () => {
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: '2' } as unknown as NodeJS.ProcessEnv)).toBe(2)
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: 'lots' } as unknown as NodeJS.ProcessEnv)).toBe(1)
  })
})

describe('isSessionRevoked', () => {
  const changed = new Date('2026-10-05T12:00:00Z')

  it('keeps sessions when the password never changed', () => {
    expect(isSessionRevoked(1, null)).toBe(false)
  })

  it('revokes a session established before the change', () => {
    expect(isSessionRevoked(changed.getTime() / 1000 - 3600, changed)).toBe(true)
  })

  it('keeps a session established after the change', () => {
    expect(isSessionRevoked(changed.getTime() / 1000 + 5, changed)).toBe(false)
  })

  it('revokes a legacy session without an authAt claim once a password changed', () => {
    expect(isSessionRevoked(undefined, changed)).toBe(true)
  })
})

describe('checkProductionEnv', () => {
  const good = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x',
    AUTH_SECRET: 'x'.repeat(40),
    APP_URL: 'https://app.example',
    AUTH_URL: 'https://app.example',
  } as unknown as NodeJS.ProcessEnv

  it('accepts a minimal valid configuration (with warnings)', () => {
    const report = checkProductionEnv(good)
    expect(report.errors).toEqual([])
    expect(report.warnings.length).toBeGreaterThan(0)
  })

  it('refuses http, a short secret and mismatched URLs', () => {
    const report = checkProductionEnv({
      ...good,
      AUTH_SECRET: 'short',
      APP_URL: 'http://app.example',
      AUTH_URL: 'https://other.example',
    } as NodeJS.ProcessEnv)
    expect(report.errors).toHaveLength(3)
  })

  it('refuses Stripe without a webhook secret', () => {
    const report = checkProductionEnv({
      ...good,
      PAYMENTS_PROVIDER: 'stripe',
      STRIPE_SECRET_KEY: 'sk_live_x',
    } as NodeJS.ProcessEnv)
    expect(report.errors.join(' ')).toMatch(/STRIPE_WEBHOOK_SECRET/)
  })

  it('does nothing outside production', () => {
    expect(checkProductionEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toEqual({
      errors: [],
      warnings: [],
    })
  })
})

describe('runtime configuration', () => {
  it('reads APP_URL at runtime, falling back safely', () => {
    expect(appUrl({ APP_URL: 'https://x.example/path' } as unknown as NodeJS.ProcessEnv)).toBe('https://x.example')
    expect(appUrl({} as NodeJS.ProcessEnv)).toBe('http://localhost:3000')
  })

  it('never invents legal details', () => {
    expect(legalEntity({ LEGAL_ENTITY_NAME: '  ' } as unknown as NodeJS.ProcessEnv)).toEqual({
      name: null,
      vat: null,
      address: null,
      email: null,
    })
  })
})

describe('Stripe API version "basil"', () => {
  it('reads the billing period from the subscription item', () => {
    const sub = normaliseStripeSubscription({
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      created: 1_700_000_000,
      items: { data: [{ price: { id: 'price_1' }, current_period_start: 1_760_000_000, current_period_end: 1_762_600_000 }] },
    })
    expect(sub.currentPeriodEnd?.getTime()).toBe(1_762_600_000 * 1000)
    expect(sub.externalPriceId).toBe('price_1')
  })

  it('still reads the legacy top-level period', () => {
    const sub = normaliseStripeSubscription({
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      current_period_end: 1_762_600_000,
      items: { data: [{ price: { id: 'price_1' } }] },
    })
    expect(sub.currentPeriodEnd?.getTime()).toBe(1_762_600_000 * 1000)
  })

  it('finds the subscription of an invoice in both shapes', () => {
    expect(invoiceSubscriptionId({ subscription: 'sub_old' })).toBe('sub_old')
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } })).toBe('sub_new')
    expect(invoiceSubscriptionId({})).toBeNull()
  })
})

describe('registration', () => {
  const base = { name: 'Sara', email: 'Sara@Example.be', password: 'a-long-enough-password' }

  it('requires explicit consent', () => {
    expect(registerSchema.safeParse({ ...base, consent: false }).success).toBe(false)
    expect(registerSchema.safeParse(base).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, consent: true }).success).toBe(true)
  })

  it('refuses passwords bcrypt would silently truncate (over 72 bytes)', () => {
    expect(registerSchema.safeParse({ ...base, consent: true, password: 'é'.repeat(37) }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, consent: true, password: 'a'.repeat(72) }).success).toBe(true)
  })
})

describe('pricing promises', () => {
  it('only lists features that exist, and never charges for data export', () => {
    const keys = PLAN_FEATURES.map((feature) => feature.key)
    expect(keys).not.toContain('plannerViews')
    expect(keys).not.toContain('statistics')
    expect(keys).not.toContain('templates')
    expect(PLAN_FEATURES.find((feature) => feature.key === 'dataExport')?.free).toBe(true)
  })
})
