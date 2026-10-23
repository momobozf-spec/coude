import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildIdempotencyKey,
  createStripeProvider,
} from '@/server/integrations/payments/stripe/stripe-provider'
import { PaymentProviderError } from '@/server/integrations/payments/types'

/**
 * Stripe adapter request mapping.
 *
 * `fetch` is stubbed throughout — no test in this suite touches the network.
 * What is asserted is the shape of what we would send, and how responses and
 * failures are handled.
 */

const provider = createStripeProvider({
  secretKey: 'sk_test_123',
  webhookSecret: 'whsec_test',
})

let fetchMock: ReturnType<typeof vi.fn>

/**
 * A Response body can only be read once, so every call must get a fresh one —
 * `mockResolvedValue` with a single Response silently fails on the second call.
 */
function respondWith(body: unknown, status = 200) {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
}

/** Decode the form body of the last request, so assertions read clearly. */
function lastBody(): URLSearchParams {
  const call = fetchMock.mock.calls.at(-1)
  return new URLSearchParams(String(call?.[1]?.body ?? ''))
}

function lastHeaders(): Record<string, string> {
  const call = fetchMock.mock.calls.at(-1)
  return (call?.[1]?.headers ?? {}) as Record<string, string>
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('idempotency keys', () => {
  const now = new Date('2026-08-08T12:00:00.000Z')

  it('is stable for the same operation inside the window', () => {
    // The property that matters: a double-click cannot create two checkouts.
    const first = buildIdempotencyKey('checkout', ['user-1', 'price_a', 'MONTHLY'], 5, now)
    const second = buildIdempotencyKey(
      'checkout',
      ['user-1', 'price_a', 'MONTHLY'],
      5,
      new Date(now.getTime() + 30_000),
    )

    expect(first).toBe(second)
  })

  it('differs per member', () => {
    expect(buildIdempotencyKey('checkout', ['user-1', 'price_a'], 5, now)).not.toBe(
      buildIdempotencyKey('checkout', ['user-2', 'price_a'], 5, now),
    )
  })

  it('differs per price', () => {
    expect(buildIdempotencyKey('checkout', ['user-1', 'price_a'], 5, now)).not.toBe(
      buildIdempotencyKey('checkout', ['user-1', 'price_b'], 5, now),
    )
  })

  it('changes after the window, so a later purchase is a new operation', () => {
    const later = new Date(now.getTime() + 20 * 60_000)

    expect(buildIdempotencyKey('checkout', ['user-1', 'price_a'], 5, now)).not.toBe(
      buildIdempotencyKey('checkout', ['user-1', 'price_a'], 5, later),
    )
  })

  it('is not random', () => {
    // A fresh UUID per attempt would silently disable deduplication.
    const keys = new Set(
      Array.from({ length: 5 }, () =>
        buildIdempotencyKey('checkout', ['user-1', 'price_a'], 5, now),
      ),
    )

    expect(keys.size).toBe(1)
  })
})

describe('checkout mapping', () => {
  it('sends subscription mode with the server-resolved price', async () => {
    fetchMock.mockImplementation(respondWith({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }))

    const session = await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'member@test.local',
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_configured',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    expect(session.url).toBe('https://checkout.stripe.com/x')

    const body = lastBody()
    expect(body.get('mode')).toBe('subscription')
    expect(body.get('line_items[0][price]')).toBe('price_configured')
    expect(body.get('client_reference_id')).toBe('user-1')
  })

  it('attaches a stable idempotency key', async () => {
    fetchMock.mockImplementation(respondWith({ id: 'cs_1', url: 'https://x' }))

    await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'a@test.local',
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_a',
      successUrl: 'https://app.test/s',
      cancelUrl: 'https://app.test/c',
    })
    const first = lastHeaders()['idempotency-key']

    await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'a@test.local',
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_a',
      successUrl: 'https://app.test/s',
      cancelUrl: 'https://app.test/c',
    })
    const second = lastHeaders()['idempotency-key']

    expect(first).toBeTruthy()
    expect(first).toBe(second)
  })

  it('reuses an existing customer instead of creating another', async () => {
    fetchMock.mockImplementation(respondWith({ id: 'cs_1', url: 'https://x' }))

    await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'member@test.local',
      plan: 'PREMIUM',
      interval: 'YEARLY',
      priceId: 'price_y',
      externalCustomerId: 'cus_existing',
      successUrl: 'https://app.test/s',
      cancelUrl: 'https://app.test/c',
    })

    const body = lastBody()
    expect(body.get('customer')).toBe('cus_existing')
    expect(body.get('customer_email')).toBeNull()
  })

  it('omits promotion codes unless policy enables them', async () => {
    fetchMock.mockImplementation(respondWith({ id: 'cs_1', url: 'https://x' }))

    await provider.createCheckoutSession({
      userId: 'user-1',
      email: 'a@test.local',
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_a',
      successUrl: 'https://app.test/s',
      cancelUrl: 'https://app.test/c',
    })

    expect(lastBody().get('allow_promotion_codes')).toBeNull()
  })

  it('fails when Stripe returns no URL', async () => {
    fetchMock.mockImplementation(respondWith({ id: 'cs_1' }))

    await expect(
      provider.createCheckoutSession({
        userId: 'u',
        email: 'a@test.local',
        plan: 'PREMIUM',
        interval: 'MONTHLY',
        priceId: 'price_a',
        successUrl: 'https://app.test/s',
        cancelUrl: 'https://app.test/c',
      }),
    ).rejects.toThrow(PaymentProviderError)
  })
})

describe('portal mapping', () => {
  it('sends the customer and a return URL', async () => {
    fetchMock.mockImplementation(respondWith({ url: 'https://billing.stripe.com/p' }))

    const session = await provider.createCustomerPortalSession({
      externalCustomerId: 'cus_1',
      returnUrl: 'https://app.test/billing',
    })

    expect(session.url).toBe('https://billing.stripe.com/p')
    expect(lastBody().get('customer')).toBe('cus_1')
  })
})

describe('failure handling', () => {
  it('maps a 401 to not-configured and does not retry', async () => {
    fetchMock.mockImplementation(respondWith({ error: 'bad key' }, 401))

    await expect(provider.getSubscription('sub_1')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps a 404 to not-found', async () => {
    fetchMock.mockImplementation(respondWith({ error: 'missing' }, 404))

    await expect(provider.getSubscription('sub_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('treats a 500 as retryable', async () => {
    fetchMock.mockImplementation(respondWith({ error: 'oops' }, 500))

    await expect(provider.getSubscription('sub_1')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      retryable: true,
    })
  })

  it('maps a network failure to unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(provider.getSubscription('sub_1')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })

  it('never leaks the secret key into an error', async () => {
    fetchMock.mockImplementation(respondWith({ error: 'sk_test_123 is invalid' }, 400))

    try {
      await provider.getSubscription('sub_1')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).not.toContain('sk_test_123')
    }
  })
})

describe('webhook verification', () => {
  it('refuses an unsigned webhook', async () => {
    await expect(provider.parseWebhook('{}', null)).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    })
  })

  it('refuses a webhook with a bad signature', async () => {
    await expect(provider.parseWebhook('{}', 't=1,v1=deadbeef')).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    })
  })

  it('refuses to verify at all without a configured secret', async () => {
    const unconfigured = createStripeProvider({ secretKey: 'sk_test_123' })

    // No webhook secret means we cannot prove an event came from Stripe, so the
    // endpoint must refuse rather than trust it.
    await expect(unconfigured.parseWebhook('{}', 't=1,v1=abc')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    })
  })
})

describe('subscription retrieval', () => {
  it('expands the price so the plan can be resolved', async () => {
    fetchMock.mockImplementation(
      respondWith({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_1' } }] },
      }),
    )

    const subscription = await provider.getSubscription('sub_1')

    expect(subscription.externalPriceId).toBe('price_1')
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('expand[]=items.data.price')
  })

  it('uses GET, so no idempotency key is attached', async () => {
    fetchMock.mockImplementation(
      respondWith({ id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [] } }),
    )

    await provider.getSubscription('sub_1')

    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe('GET')
    expect(lastHeaders()['idempotency-key']).toBeUndefined()
  })
})
