import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

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
 * Stripe adapter.
 *
 * Talks to the REST API over `fetch`, for the same reasons as the AI adapters:
 * no large dependency installed for credentials nobody has configured, and no
 * vendor code that could reach a client bundle. The Stripe API is form-encoded
 * and stable; the surface used here is small.
 *
 * Card details never touch this application — Checkout and the Customer Portal
 * are provider-hosted, which is what keeps us out of PCI scope.
 */

const API_BASE = 'https://api.stripe.com/v1'
const TIMEOUT_MS = 20_000
/** Reject signatures older than this, so a captured payload cannot be replayed. */
const SIGNATURE_TOLERANCE_SECONDS = 300

interface StripeConfig {
  secretKey: string
  webhookSecret?: string
}

/** Stripe wants form encoding, including bracketed nested keys. */
function toFormBody(data: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = []

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue

    const encodedKey = prefix ? `${prefix}[${key}]` : key

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(...toFormBody(value as Record<string, unknown>, encodedKey))
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(...toFormBody(item as Record<string, unknown>, `${encodedKey}[${index}]`))
        } else {
          parts.push(`${encodeURIComponent(`${encodedKey}[${index}]`)}=${encodeURIComponent(String(item))}`)
        }
      })
    } else {
      parts.push(`${encodeURIComponent(encodedKey)}=${encodeURIComponent(String(value))}`)
    }
  }

  return parts
}

function mapError(status: number, body: string): PaymentProviderError {
  if (status === 401 || status === 403) {
    return new PaymentProviderError('NOT_CONFIGURED', 'Stripe rejected our credentials.')
  }
  if (status === 404) {
    return new PaymentProviderError('NOT_FOUND', 'Stripe could not find that object.')
  }
  if (status === 429 || status >= 500) {
    return new PaymentProviderError('UNAVAILABLE', 'Stripe is temporarily unavailable.', {
      retryable: true,
    })
  }
  return new PaymentProviderError('REJECTED', 'Stripe rejected the request.', {
    cause: body.slice(0, 500),
  })
}

/**
 * A stable idempotency key for a create operation.
 *
 * Derived from the operation's identity plus a coarse time bucket, NOT from a
 * random value. A random key per attempt would defeat the purpose entirely:
 * Stripe would treat a retried double-click as a new operation and create a
 * second checkout session. With this, the same member choosing the same price
 * inside the window always reaches the same session.
 *
 * The bucket bounds it, so a deliberate purchase an hour later is a new
 * operation rather than being deduplicated forever.
 */
export function buildIdempotencyKey(
  operation: string,
  identity: string[],
  bucketMinutes = 5,
  now: Date = new Date(),
): string {
  const bucket = Math.floor(now.getTime() / (bucketMinutes * 60_000))
  const digest = createHash('sha256')
    .update([operation, ...identity, String(bucket)].join('|'))
    .digest('hex')
    .slice(0, 32)

  return `${operation}_${digest}`
}

async function stripeRequest(
  secretKey: string,
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: Record<string, unknown>
    /** Stable key for create operations. Reused across retry attempts. */
    idempotencyKey?: string
  } = {},
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const method = options.method ?? 'POST'
    const encoded = options.body ? toFormBody(options.body).join('&') : undefined

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        // Only sent when the caller supplied a STABLE key. Omitting it is
        // safer than sending a random one, which would silently disable
        // deduplication while looking like it was enabled.
        ...(method === 'POST' && options.idempotencyKey
          ? { 'idempotency-key': options.idempotencyKey }
          : {}),
      },
      body: method === 'POST' ? encoded : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw mapError(response.status, await response.text().catch(() => ''))
    }

    return (await response.json()) as Record<string, unknown>
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PaymentProviderError('UNAVAILABLE', 'Stripe did not respond in time.', {
        retryable: true,
      })
    }
    throw new PaymentProviderError('UNAVAILABLE', 'Could not reach Stripe.', {
      retryable: true,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Verify a Stripe webhook signature.
 *
 * HMAC-SHA256 over `${timestamp}.${payload}` against the endpoint secret, with a
 * timestamp tolerance to stop replay. Compared with `timingSafeEqual` — a plain
 * `===` leaks the correct signature one byte at a time.
 */
export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  const parts = new Map<string, string[]>()

  for (const segment of header.split(',')) {
    const [key, value] = segment.split('=')
    if (!key || !value) continue
    const existing = parts.get(key.trim())
    if (existing) existing.push(value.trim())
    else parts.set(key.trim(), [value.trim()])
  }

  const timestamp = parts.get('t')?.[0]
  const signatures = parts.get('v1') ?? []

  if (!timestamp || signatures.length === 0) return false

  const age = Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest()

  return signatures.some((candidate) => {
    let provided: Buffer
    try {
      provided = Buffer.from(candidate, 'hex')
    } catch {
      return false
    }
    if (provided.length !== expected.length) return false
    return timingSafeEqual(provided, expected)
  })
}

function toDate(value: unknown): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null
}

/**
 * The subscription an invoice belongs to. Moved in API version "basil" from
 * `invoice.subscription` to `invoice.parent.subscription_details.subscription`.
 */
export function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  if (typeof invoice.subscription === 'string') return invoice.subscription
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined
  const nested = parent?.subscription_details?.subscription
  return typeof nested === 'string' ? nested : null
}

/** Normalise a Stripe subscription object. */
export function normaliseStripeSubscription(raw: Record<string, unknown>): ExternalSubscription {
  const items = raw.items as
    | {
        data?: {
          price?: { id?: string }
          current_period_start?: number
          current_period_end?: number
        }[]
      }
    | undefined
  const firstItem = items?.data?.[0]
  const priceId = firstItem?.price?.id ?? null

  // Since API version 2025-03-31 ("basil") Stripe reports the billing period on
  // each subscription ITEM, not on the subscription. New accounts default to
  // such a version, so the item is read first, with the legacy top-level fields
  // as fallback. Without this the period end is null and the past-due grace
  // window silently never applies.
  return {
    externalSubscriptionId: String(raw.id),
    externalCustomerId:
      typeof raw.customer === 'string'
        ? raw.customer
        : String((raw.customer as { id?: string } | undefined)?.id ?? ''),
    externalPriceId: priceId,
    status: String(raw.status) as ExternalSubscriptionStatus,
    currentPeriodStart: toDate(firstItem?.current_period_start ?? raw.current_period_start),
    currentPeriodEnd: toDate(firstItem?.current_period_end ?? raw.current_period_end),
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
    trialEndsAt: toDate(raw.trial_end),
    // Stripe's own timestamp, which is what makes out-of-order rejection possible.
    providerUpdatedAt: toDate(raw.created) ?? new Date(),
  }
}

export function createStripeProvider(config: StripeConfig): PaymentProvider {
  return {
    id: 'stripe',
    isConfigured: true,

    async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
      // Computed once here, so a network retry inside `stripeRequest` and a
      // member's double-click both resolve to the same session.
      const idempotencyKey = buildIdempotencyKey('checkout', [
        input.userId,
        input.priceId,
        input.interval,
      ])

      const session = await stripeRequest(config.secretKey, '/checkout/sessions', {
        idempotencyKey,
        body: {
          mode: 'subscription',
          // Price comes from server config; the browser never supplies one.
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: input.cancelUrl,
          ...(input.externalCustomerId
            ? { customer: input.externalCustomerId }
            : { customer_email: input.email }),
          // Carried back on the webhook so we can attach the subscription to a
          // member without trusting anything from the redirect.
          client_reference_id: input.userId,
          subscription_data: {
            metadata: { userId: input.userId, plan: input.plan },
            // The pricing page promises a trial on yearly plans; this is what
            // makes that promise true at Stripe.
            ...(input.trialDays && input.trialDays > 0
              ? { trial_period_days: input.trialDays }
              : {}),
          },
          metadata: { userId: input.userId, plan: input.plan },
          ...(input.allowPromotionCodes ? { allow_promotion_codes: true } : {}),
        },
      })

      const url = session.url
      if (typeof url !== 'string') {
        throw new PaymentProviderError('REJECTED', 'Stripe returned no checkout URL.')
      }

      return { id: String(session.id), url }
    },

    async createCustomerPortalSession(input: PortalSessionInput): Promise<PortalSession> {
      const session = await stripeRequest(config.secretKey, '/billing_portal/sessions', {
        body: { customer: input.externalCustomerId, return_url: input.returnUrl },
      })

      const url = session.url
      if (typeof url !== 'string') {
        throw new PaymentProviderError('REJECTED', 'Stripe returned no portal URL.')
      }

      return { url }
    },

    async parseWebhook(payload: string, signature?: string | null): Promise<PaymentWebhookEvent> {
      if (!config.webhookSecret) {
        throw new PaymentProviderError(
          'NOT_CONFIGURED',
          'STRIPE_WEBHOOK_SECRET is not set; webhooks cannot be verified.',
        )
      }

      // Mandatory in Stripe mode. An unverified webhook is an open endpoint for
      // anyone to grant themselves a subscription.
      if (!signature || !verifyStripeSignature(payload, signature, config.webhookSecret)) {
        throw new PaymentProviderError('SIGNATURE_INVALID', 'Invalid webhook signature.')
      }

      const event = JSON.parse(payload) as {
        id: string
        type: string
        created: number
        data: { object: Record<string, unknown> }
      }

      const externalEventId = event.id
      const eventCreatedAt = new Date(event.created * 1000)
      const object = event.data.object

      switch (event.type) {
        case 'checkout.session.completed': {
          const subscriptionId = object.subscription
          if (typeof subscriptionId !== 'string') {
            return { type: 'UNSUPPORTED', externalEventId, eventCreatedAt, rawType: event.type }
          }

          // Re-read the subscription rather than trusting the session object:
          // the session is a snapshot of intent, the subscription is the state.
          const raw = await stripeRequest(
            config.secretKey,
            `/subscriptions/${subscriptionId}?expand[]=items.data.price`,
            { method: 'GET' },
          )

          return {
            type: 'SUBSCRIPTION_CHANGED',
            externalEventId,
            eventCreatedAt,
            subscription: { ...normaliseStripeSubscription(raw), providerUpdatedAt: eventCreatedAt },
            userId:
              typeof object.client_reference_id === 'string' ? object.client_reference_id : null,
          }
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          return {
            type: 'SUBSCRIPTION_CHANGED',
            externalEventId,
            eventCreatedAt,
            subscription: {
              ...normaliseStripeSubscription(object),
              providerUpdatedAt: eventCreatedAt,
            },
            userId:
              typeof (object.metadata as { userId?: string } | undefined)?.userId === 'string'
                ? (object.metadata as { userId: string }).userId
                : null,
          }

        case 'customer.subscription.deleted':
          return {
            type: 'SUBSCRIPTION_DELETED',
            externalEventId,
            eventCreatedAt,
            subscription: {
              ...normaliseStripeSubscription(object),
              providerUpdatedAt: eventCreatedAt,
            },
          }

        case 'invoice.payment_failed':
          return {
            type: 'PAYMENT_FAILED',
            externalEventId,
            eventCreatedAt,
            externalCustomerId: String(object.customer ?? ''),
            externalSubscriptionId: invoiceSubscriptionId(object),
          }

        case 'invoice.paid':
          return {
            type: 'PAYMENT_SUCCEEDED',
            externalEventId,
            eventCreatedAt,
            externalCustomerId: String(object.customer ?? ''),
            externalSubscriptionId: invoiceSubscriptionId(object),
          }

        default:
          // Verified and recorded, but not acted on.
          return { type: 'UNSUPPORTED', externalEventId, eventCreatedAt, rawType: event.type }
      }
    },

    async getSubscription(externalSubscriptionId: string): Promise<ExternalSubscription> {
      const raw = await stripeRequest(
        config.secretKey,
        `/subscriptions/${externalSubscriptionId}?expand[]=items.data.price`,
        { method: 'GET' },
      )

      return normaliseStripeSubscription(raw)
    },
  }
}
