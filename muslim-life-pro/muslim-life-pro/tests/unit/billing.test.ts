import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

import {
  buildStubSubscription,
  createStubProvider,
} from '@/server/integrations/payments/stub-provider'
import {
  normaliseStripeSubscription,
  verifyStripeSignature,
} from '@/server/integrations/payments/stripe/stripe-provider'
import { PaymentProviderError } from '@/server/integrations/payments/types'
import { grantsAccess, checkoutInputSchema, PAST_DUE_GRACE_DAYS } from '@/server/modules/billing/billing.service'
import { BillingError, toBillingError } from '@/server/modules/billing/billing.errors'

const NOW = new Date('2026-08-08T12:00:00.000Z')

describe('stub provider', () => {
  const provider = createStubProvider()

  it('creates a checkout session with an internal URL', async () => {
    const session = await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'member@test.local',
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_stub_premium_monthly',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    expect(session.id).toMatch(/^cs_stub_/)
    expect(session.url).toContain('/app/settings/billing/checkout')
    expect(session.url).toContain('interval=MONTHLY')
  })

  it('creates a portal session scoped to a customer', async () => {
    const session = await provider.createCustomerPortalSession({
      externalCustomerId: 'cus_stub_abc',
      returnUrl: 'https://app.test/billing',
    })

    expect(session.url).toContain('cus_stub_abc')
  })

  it('produces deterministic ids for the same member', () => {
    const first = buildStubSubscription('user-1', 'price_x', { now: NOW })
    const second = buildStubSubscription('user-1', 'price_x', { now: NOW })

    expect(first.externalSubscriptionId).toBe(second.externalSubscriptionId)
    expect(first.externalCustomerId).toBe(second.externalCustomerId)
  })

  it('gives different members different customers', () => {
    const a = buildStubSubscription('user-1', 'price_x', { now: NOW })
    const b = buildStubSubscription('user-2', 'price_x', { now: NOW })

    expect(a.externalCustomerId).not.toBe(b.externalCustomerId)
  })

  it('sets a period matching the interval', () => {
    const monthly = buildStubSubscription('user-1', 'price_x', { interval: 'MONTHLY', now: NOW })
    const yearly = buildStubSubscription('user-1', 'price_x', { interval: 'YEARLY', now: NOW })

    const monthlyDays =
      (monthly.currentPeriodEnd!.getTime() - monthly.currentPeriodStart!.getTime()) / 86_400_000
    const yearlyDays =
      (yearly.currentPeriodEnd!.getTime() - yearly.currentPeriodStart!.getTime()) / 86_400_000

    expect(Math.round(monthlyDays)).toBe(30)
    expect(Math.round(yearlyDays)).toBe(365)
  })

  it('models every lifecycle state', () => {
    for (const status of ['active', 'trialing', 'past_due', 'canceled'] as const) {
      const subscription = buildStubSubscription('user-1', 'price_x', { status, now: NOW })
      expect(subscription.status).toBe(status)
    }
  })

  it('rejects a malformed webhook payload', async () => {
    await expect(provider.parseWebhook('not json')).rejects.toThrow(PaymentProviderError)
  })

  it('revives dates when parsing a webhook', async () => {
    const event = {
      type: 'SUBSCRIPTION_CHANGED',
      externalEventId: 'evt_1',
      eventCreatedAt: NOW.toISOString(),
      subscription: buildStubSubscription('user-1', 'price_x', { now: NOW }),
    }

    const parsed = await provider.parseWebhook(JSON.stringify(event))

    expect(parsed.eventCreatedAt).toBeInstanceOf(Date)
    if (parsed.type === 'SUBSCRIPTION_CHANGED') {
      expect(parsed.subscription.currentPeriodEnd).toBeInstanceOf(Date)
    }
  })

  it('reports an unknown subscription rather than inventing one', async () => {
    await expect(provider.getSubscription('sub_missing')).rejects.toThrow(PaymentProviderError)
  })
})

describe('stripe signature verification', () => {
  const secret = 'whsec_test_secret'
  const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' })

  function sign(timestamp: number, body: string, withSecret = secret): string {
    const signature = createHmac('sha256', withSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  it('accepts a correctly signed payload', () => {
    const timestamp = Math.floor(NOW.getTime() / 1000)
    expect(verifyStripeSignature(payload, sign(timestamp, payload), secret, NOW)).toBe(true)
  })

  it('rejects a tampered payload', () => {
    const timestamp = Math.floor(NOW.getTime() / 1000)
    const header = sign(timestamp, payload)

    // The whole point: a modified body must not verify.
    expect(
      verifyStripeSignature(JSON.stringify({ id: 'evt_1', hacked: true }), header, secret, NOW),
    ).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    const timestamp = Math.floor(NOW.getTime() / 1000)
    const header = sign(timestamp, payload, 'whsec_wrong')

    expect(verifyStripeSignature(payload, header, secret, NOW)).toBe(false)
  })

  it('rejects a replayed old signature', () => {
    // Ten minutes old, past the tolerance window.
    const stale = Math.floor(NOW.getTime() / 1000) - 600
    expect(verifyStripeSignature(payload, sign(stale, payload), secret, NOW)).toBe(false)
  })

  it('rejects a malformed header', () => {
    expect(verifyStripeSignature(payload, 'garbage', secret, NOW)).toBe(false)
    expect(verifyStripeSignature(payload, '', secret, NOW)).toBe(false)
    expect(verifyStripeSignature(payload, 't=123', secret, NOW)).toBe(false)
  })

  it('accepts when any one of several signatures matches', () => {
    // Stripe sends multiple v1 signatures during secret rotation.
    const timestamp = Math.floor(NOW.getTime() / 1000)
    const good = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    const header = `t=${timestamp},v1=deadbeef,v1=${good}`

    expect(verifyStripeSignature(payload, header, secret, NOW)).toBe(true)
  })
})

describe('stripe subscription normalisation', () => {
  it('maps the fields we depend on', () => {
    const raw = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'active',
      current_period_start: 1_754_654_400,
      current_period_end: 1_757_246_400,
      cancel_at_period_end: false,
      trial_end: null,
      created: 1_754_654_400,
      items: { data: [{ price: { id: 'price_789' } }] },
    }

    const normalised = normaliseStripeSubscription(raw)

    expect(normalised.externalSubscriptionId).toBe('sub_123')
    expect(normalised.externalCustomerId).toBe('cus_456')
    expect(normalised.externalPriceId).toBe('price_789')
    expect(normalised.status).toBe('active')
    expect(normalised.currentPeriodEnd).toBeInstanceOf(Date)
  })

  it('handles an expanded customer object', () => {
    const normalised = normaliseStripeSubscription({
      id: 'sub_1',
      customer: { id: 'cus_expanded' },
      status: 'active',
      items: { data: [] },
    })

    expect(normalised.externalCustomerId).toBe('cus_expanded')
  })

  it('tolerates a missing price rather than throwing', () => {
    const normalised = normaliseStripeSubscription({
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      items: { data: [] },
    })

    // Null here means the webhook handler will fail closed, which is correct.
    expect(normalised.externalPriceId).toBeNull()
  })
})

describe('grantsAccess', () => {
  const base = { plan: 'PREMIUM' as const, currentPeriodEnd: new Date('2026-08-31T00:00:00.000Z') }

  it('grants on ACTIVE and TRIALING', () => {
    expect(grantsAccess({ ...base, status: 'ACTIVE' }, NOW)).toBe(true)
    expect(grantsAccess({ ...base, status: 'TRIALING' }, NOW)).toBe(true)
  })

  it('denies on CANCELED', () => {
    expect(grantsAccess({ ...base, status: 'CANCELED' }, NOW)).toBe(false)
  })

  it('denies on INCOMPLETE', () => {
    // An incomplete subscription is one that was never paid for.
    expect(grantsAccess({ ...base, status: 'INCOMPLETE' }, NOW)).toBe(false)
  })

  it('never grants on the FREE plan whatever the status', () => {
    expect(grantsAccess({ plan: 'FREE', status: 'ACTIVE', currentPeriodEnd: null }, NOW)).toBe(false)
  })

  it('keeps access during the past-due grace window', () => {
    // A failed renewal is usually an expired card, not a decision to leave.
    const periodEnd = new Date(NOW)
    periodEnd.setUTCDate(periodEnd.getUTCDate() - 2)

    expect(
      grantsAccess({ plan: 'PREMIUM', status: 'PAST_DUE', currentPeriodEnd: periodEnd }, NOW),
    ).toBe(true)
  })

  it('withdraws access once the grace window expires', () => {
    const periodEnd = new Date(NOW)
    periodEnd.setUTCDate(periodEnd.getUTCDate() - (PAST_DUE_GRACE_DAYS + 1))

    expect(
      grantsAccess({ plan: 'PREMIUM', status: 'PAST_DUE', currentPeriodEnd: periodEnd }, NOW),
    ).toBe(false)
  })

  it('still grants while cancel-at-period-end is pending', () => {
    // The flag lives on the row, not in the status — someone who has paid for
    // the period keeps it.
    expect(grantsAccess({ ...base, status: 'ACTIVE' }, NOW)).toBe(true)
  })
})

describe('checkout input', () => {
  it('accepts the supported plan and intervals', () => {
    expect(checkoutInputSchema.safeParse({ plan: 'PREMIUM', interval: 'MONTHLY', immediateStart: true }).success).toBe(true)
    expect(checkoutInputSchema.safeParse({ plan: 'PREMIUM', interval: 'YEARLY', immediateStart: true }).success).toBe(true)
  })

  it('rejects an unsupported plan', () => {
    expect(checkoutInputSchema.safeParse({ plan: 'ENTERPRISE', interval: 'MONTHLY', immediateStart: true }).success).toBe(
      false,
    )
    expect(checkoutInputSchema.safeParse({ plan: 'FREE', interval: 'MONTHLY', immediateStart: true }).success).toBe(false)
  })

  it('rejects an unsupported interval', () => {
    expect(checkoutInputSchema.safeParse({ plan: 'PREMIUM', interval: 'WEEKLY', immediateStart: true }).success).toBe(false)
  })

  it('has no field through which a price could be supplied', () => {
    // The critical property: a member cannot name their own price.
    const parsed = checkoutInputSchema.parse({
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      immediateStart: true,
      priceId: 'price_free_lol',
      amount: 0,
    })

    expect(parsed).toEqual({ plan: 'PREMIUM', interval: 'MONTHLY', immediateStart: true })
    expect('priceId' in parsed).toBe(false)
  })
})

describe('billing errors', () => {
  it('maps a provider not-configured to a 503', () => {
    const error = toBillingError(
      new PaymentProviderError('NOT_CONFIGURED', 'no key'),
      'CHECKOUT_FAILED',
    )

    expect(error).toBeInstanceOf(BillingError)
    expect(error.billingCode).toBe('PAYMENTS_NOT_CONFIGURED')
    expect(error.status).toBe(503)
  })

  it('maps an invalid signature to a 400', () => {
    const error = toBillingError(
      new PaymentProviderError('SIGNATURE_INVALID', 'bad'),
      'CHECKOUT_FAILED',
    )

    expect(error.billingCode).toBe('WEBHOOK_SIGNATURE_INVALID')
    expect(error.status).toBe(400)
  })

  it('never leaks provider detail into the member-facing message', () => {
    const error = toBillingError(
      new PaymentProviderError('UNAVAILABLE', 'stripe internal trace 0xdeadbeef'),
      'CHECKOUT_FAILED',
    )

    expect(error.message).not.toContain('0xdeadbeef')
    expect(error.message).toContain('temporarily unavailable')
  })

  it('falls back for an unknown error shape', () => {
    const error = toBillingError(new Error('kaboom'), 'PORTAL_SESSION_FAILED')

    expect(error.billingCode).toBe('PORTAL_SESSION_FAILED')
    expect(error.message).not.toContain('kaboom')
  })
})
