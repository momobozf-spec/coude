import type { BillingInterval, Plan } from '@prisma/client'

/**
 * The payment provider contract.
 *
 * The ONLY surface business code may depend on. No service outside
 * `src/server/integrations/payments/` imports a vendor SDK or knows a price ID.
 */

export interface CreateCheckoutInput {
  userId: string
  email: string
  plan: Plan
  interval: BillingInterval
  /** Resolved server-side from config. Never taken from the browser. */
  priceId: string
  /** Existing provider customer, when the member already has one. */
  externalCustomerId?: string | null
  successUrl: string
  cancelUrl: string
  /** Provider-configured promotion codes, when policy allows them. */
  allowPromotionCodes?: boolean
  /** Free trial length, decided server-side (yearly plans only). */
  trialDays?: number
}

export interface CheckoutSession {
  id: string
  /** Where to send the member. Always provider-hosted — we never take card details. */
  url: string
}

export interface PortalSessionInput {
  externalCustomerId: string
  returnUrl: string
}

export interface PortalSession {
  url: string
}

/** Provider-neutral subscription state. */
export interface ExternalSubscription {
  externalSubscriptionId: string
  externalCustomerId: string
  externalPriceId: string | null
  status: ExternalSubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date | null
  /** Provider's own last-modified timestamp, used to reject stale events. */
  providerUpdatedAt: Date
}

export type ExternalSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

/**
 * Normalised webhook event.
 *
 * Adapters translate vendor event names into this closed set, so the business
 * service never switches on `'customer.subscription.updated'`.
 */
export type PaymentWebhookEvent =
  | {
      type: 'SUBSCRIPTION_CHANGED'
      externalEventId: string
      eventCreatedAt: Date
      subscription: ExternalSubscription
      /** Present on checkout completion, so we can attach the customer. */
      userId?: string | null
    }
  | {
      type: 'SUBSCRIPTION_DELETED'
      externalEventId: string
      eventCreatedAt: Date
      subscription: ExternalSubscription
    }
  | {
      type: 'PAYMENT_FAILED'
      externalEventId: string
      eventCreatedAt: Date
      externalCustomerId: string
      externalSubscriptionId: string | null
    }
  | {
      type: 'PAYMENT_SUCCEEDED'
      externalEventId: string
      eventCreatedAt: Date
      externalCustomerId: string
      externalSubscriptionId: string | null
    }
  | {
      /** Received, verified, and deliberately not acted on. Still recorded. */
      type: 'UNSUPPORTED'
      externalEventId: string
      eventCreatedAt: Date
      rawType: string
    }

export interface PaymentProvider {
  readonly id: string
  readonly isConfigured: boolean

  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>
  createCustomerPortalSession(input: PortalSessionInput): Promise<PortalSession>

  /**
   * Verify and normalise a webhook.
   *
   * Takes the RAW body — any parsing or re-serialisation before this point
   * breaks the signature.
   */
  parseWebhook(payload: string, signature?: string | null): Promise<PaymentWebhookEvent>

  /** Re-read state from the provider. Used by reconciliation. */
  getSubscription(externalSubscriptionId: string): Promise<ExternalSubscription>
}

/** Typed provider failures. SDK/HTTP detail never crosses this boundary. */
export class PaymentProviderError extends Error {
  readonly code:
    | 'NOT_CONFIGURED'
    | 'SIGNATURE_INVALID'
    | 'UNAVAILABLE'
    | 'REJECTED'
    | 'NOT_FOUND'
  readonly retryable: boolean

  constructor(
    code: PaymentProviderError['code'],
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'PaymentProviderError'
    this.code = code
    this.retryable = options.retryable ?? code === 'UNAVAILABLE'
  }
}
