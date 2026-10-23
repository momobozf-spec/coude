import { createHash, randomUUID } from 'node:crypto'

import {
  PaymentProviderError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type ExternalSubscription,
  type ExternalSubscriptionStatus,
  type PaymentProvider,
  type PaymentWebhookEvent,
  type PortalSession,
  type PortalSessionInput,
} from '@/server/integrations/payments/types'

/**
 * Stub payment provider.
 *
 * The default, and a genuinely complete development provider: the entire billing
 * flow — checkout, success, cancel, webhooks, portal, cancel-at-period-end,
 * past-due — works end to end with no credentials and no spend.
 *
 * Checkout returns an internal URL rather than a provider-hosted page, so the
 * local flow mirrors the real one without leaving the app.
 */

const PERIOD_DAYS = { MONTHLY: 30, YEARLY: 365 } as const

/**
 * Deterministic ids derived from the member, so a reseeded database produces
 * stable identifiers and tests can assert on them.
 */
function stubId(prefix: string, seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 24)
  return `${prefix}_stub_${hash}`
}

export interface StubSubscriptionOptions {
  status?: ExternalSubscriptionStatus
  interval?: 'MONTHLY' | 'YEARLY'
  cancelAtPeriodEnd?: boolean
  trialDays?: number
  now?: Date
}

/**
 * Build a subscription object as the provider would report it.
 *
 * Exported so the dev webhook simulator and the tests construct exactly the same
 * shape the real adapter produces.
 */
export function buildStubSubscription(
  userId: string,
  priceId: string,
  options: StubSubscriptionOptions = {},
): ExternalSubscription {
  const now = options.now ?? new Date()
  const interval = options.interval ?? 'MONTHLY'

  const periodStart = new Date(now)
  const periodEnd = new Date(now)
  periodEnd.setUTCDate(periodEnd.getUTCDate() + PERIOD_DAYS[interval])

  const trialEndsAt = options.trialDays
    ? new Date(now.getTime() + options.trialDays * 86_400_000)
    : null

  return {
    externalSubscriptionId: stubId('sub', userId),
    externalCustomerId: stubId('cus', userId),
    externalPriceId: priceId,
    status: options.status ?? 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
    trialEndsAt,
    providerUpdatedAt: now,
  }
}

/** In-memory store, so `getSubscription` can answer after a simulated webhook. */
const store = new Map<string, ExternalSubscription>()

export function rememberStubSubscription(subscription: ExternalSubscription) {
  store.set(subscription.externalSubscriptionId, subscription)
}

export function resetStubStore() {
  store.clear()
}

export function createStubProvider(): PaymentProvider {
  return {
    id: 'stub',
    isConfigured: true,

    async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const sessionId = `cs_stub_${randomUUID()}`

      // An internal route that simulates the provider-hosted page. The real
      // adapter returns a Stripe URL here; nothing else in the flow differs.
      const url = new URL(input.successUrl)
      url.searchParams.set('session_id', sessionId)
      url.searchParams.set('stub', '1')
      url.searchParams.set('plan', input.plan)
      url.searchParams.set('interval', input.interval)

      return {
        id: sessionId,
        url: `/app/settings/billing/checkout?session=${encodeURIComponent(sessionId)}&plan=${input.plan}&interval=${input.interval}`,
      }
    },

    async createCustomerPortalSession(input: PortalSessionInput): Promise<PortalSession> {
      return {
        url: `/app/settings/billing/portal?customer=${encodeURIComponent(input.externalCustomerId)}&return=${encodeURIComponent(input.returnUrl)}`,
      }
    },

    async parseWebhook(payload: string): Promise<PaymentWebhookEvent> {
      // No signature in stub mode — the route that accepts stub webhooks is
      // itself refused outside development.
      let parsed: unknown
      try {
        parsed = JSON.parse(payload)
      } catch {
        throw new PaymentProviderError('REJECTED', 'Malformed stub webhook payload.')
      }

      const event = parsed as Partial<PaymentWebhookEvent> & { type?: string }
      if (!event.type) {
        throw new PaymentProviderError('REJECTED', 'Stub webhook has no type.')
      }

      // Revive dates that JSON flattened to strings.
      return reviveDates(event) as PaymentWebhookEvent
    },

    async getSubscription(externalSubscriptionId: string): Promise<ExternalSubscription> {
      const known = store.get(externalSubscriptionId)
      if (!known) {
        throw new PaymentProviderError('NOT_FOUND', 'No such subscription in the stub provider.')
      }
      return known
    },
  }
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates)

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (
        typeof item === 'string' &&
        /^(currentPeriod(Start|End)|trialEndsAt|providerUpdatedAt|eventCreatedAt)$/.test(key)
      ) {
        out[key] = new Date(item)
      } else {
        out[key] = reviveDates(item)
      }
    }
    return out
  }

  return value
}
