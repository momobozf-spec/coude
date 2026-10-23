import 'server-only'

import { isProduction, serverEnv } from '@/config/env'
import { createStripeProvider } from '@/server/integrations/payments/stripe/stripe-provider'
import { createStubProvider } from '@/server/integrations/payments/stub-provider'
import { PaymentProviderError, type PaymentProvider } from '@/server/integrations/payments/types'

export * from '@/server/integrations/payments/types'

/**
 * Provider resolution.
 *
 * Same fail-closed rule as the assistant, for the same reason: naming a provider
 * without its credentials is a misconfiguration, not a cue to quietly serve a
 * fake. Charging — or appearing to charge — through a stub would be worse than
 * an outage.
 *
 *   PAYMENTS_PROVIDER=stub                  → stub (refused in production)
 *   PAYMENTS_PROVIDER=stripe, no secret key → PAYMENTS_NOT_CONFIGURED
 */

export type PaymentsStatus =
  | { configured: true; providerId: 'stripe' | 'stub'; isStub: boolean }
  | { configured: false; reason: PaymentsNotConfiguredReason; providerId: string }

export type PaymentsNotConfiguredReason =
  | 'MISSING_SECRET_KEY'
  | 'MISSING_PRICES'
  | 'STUB_NOT_ALLOWED_IN_PRODUCTION'

let cached: PaymentProvider | null = null
let cachedStatus: PaymentsStatus | null = null

function resolve(): { provider: PaymentProvider | null; status: PaymentsStatus } {
  const env = serverEnv()

  if (env.PAYMENTS_PROVIDER === 'stripe') {
    if (!env.STRIPE_SECRET_KEY) {
      return {
        provider: null,
        status: { configured: false, reason: 'MISSING_SECRET_KEY', providerId: 'stripe' },
      }
    }

    // Without price IDs there is nothing to sell. Failing here beats failing
    // halfway through a member's checkout.
    if (!env.STRIPE_PRICE_PREMIUM_MONTHLY || !env.STRIPE_PRICE_PREMIUM_YEARLY) {
      return {
        provider: null,
        status: { configured: false, reason: 'MISSING_PRICES', providerId: 'stripe' },
      }
    }

    return {
      provider: createStripeProvider({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      }),
      status: { configured: true, providerId: 'stripe', isStub: false },
    }
  }

  if (isProduction && !env.ALLOW_STUB_PAYMENTS_IN_PRODUCTION) {
    return {
      provider: null,
      status: {
        configured: false,
        reason: 'STUB_NOT_ALLOWED_IN_PRODUCTION',
        providerId: 'stub',
      },
    }
  }

  return {
    provider: createStubProvider(),
    status: { configured: true, providerId: 'stub', isStub: true },
  }
}

/** Status, for UI and health checks. Never throws. */
export function getPaymentsStatus(): PaymentsStatus {
  if (cachedStatus) return cachedStatus

  const { provider, status } = resolve()
  cached = provider
  cachedStatus = status
  return status
}

/** The provider. Throws when the environment names one it cannot use. */
export function getPaymentProvider(): PaymentProvider {
  const status = getPaymentsStatus()

  if (!status.configured || !cached) {
    const reason = status.configured ? null : status.reason

    throw new PaymentProviderError(
      'NOT_CONFIGURED',
      reason === 'STUB_NOT_ALLOWED_IN_PRODUCTION'
        ? 'Stub billing cannot be used in production. Configure Stripe, or set ALLOW_STUB_PAYMENTS_IN_PRODUCTION=true for a demo deployment.'
        : reason === 'MISSING_PRICES'
          ? 'Stripe is selected but STRIPE_PRICE_PREMIUM_MONTHLY / STRIPE_PRICE_PREMIUM_YEARLY are not set.'
          : 'PAYMENTS_PROVIDER is "stripe" but STRIPE_SECRET_KEY is not set.',
    )
  }

  return cached
}

/** True when real money can move. */
export function isLivePayments(): boolean {
  const status = getPaymentsStatus()
  return status.configured && !status.isStub
}

export function isPaymentsConfigured(): boolean {
  return getPaymentsStatus().configured
}

/** Test seam. */
export function setPaymentProvider(provider: PaymentProvider | null) {
  cached = provider
  cachedStatus = provider
    ? {
        configured: true,
        providerId: provider.id === 'stripe' ? 'stripe' : 'stub',
        isStub: provider.id !== 'stripe',
      }
    : null
}
