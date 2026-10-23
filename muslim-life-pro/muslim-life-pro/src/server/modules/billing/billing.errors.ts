import { AppError } from '@/lib/errors'
import { PaymentProviderError } from '@/server/integrations/payments'

export type BillingErrorCode =
  | 'PAYMENTS_NOT_CONFIGURED'
  | 'INVALID_PLAN'
  | 'INVALID_BILLING_INTERVAL'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_ALREADY_ACTIVE'
  | 'CHECKOUT_FAILED'
  | 'PORTAL_SESSION_FAILED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'WEBHOOK_EVENT_UNSUPPORTED'
  | 'UNKNOWN_PRICE'

/** Billing-domain errors. Provider SDK/HTTP detail never reaches the browser. */
export class BillingError extends AppError {
  readonly billingCode: BillingErrorCode

  constructor(code: BillingErrorCode, message: string, status = 400) {
    super(
      code === 'SUBSCRIPTION_NOT_FOUND'
        ? 'NOT_FOUND'
        : code === 'SUBSCRIPTION_ALREADY_ACTIVE'
          ? 'CONFLICT'
          : status >= 500
            ? 'PROVIDER_ERROR'
            : 'VALIDATION_ERROR',
      message,
      { status, meta: { billingCode: code } },
    )
    this.billingCode = code
  }
}

/** Map a provider failure onto a member-safe domain error. */
export function toBillingError(error: unknown, fallback: BillingErrorCode): BillingError {
  if (error instanceof BillingError) return error

  if (error instanceof PaymentProviderError) {
    switch (error.code) {
      case 'NOT_CONFIGURED':
        // Operator-facing: saying so plainly beats a vague "try again later".
        return new BillingError('PAYMENTS_NOT_CONFIGURED', error.message, 503)
      case 'SIGNATURE_INVALID':
        return new BillingError('WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.', 400)
      case 'NOT_FOUND':
        return new BillingError('SUBSCRIPTION_NOT_FOUND', 'That subscription no longer exists.', 404)
      default:
        return new BillingError(
          fallback,
          'Billing is temporarily unavailable. Please try again shortly.',
          502,
        )
    }
  }

  return new BillingError(fallback, 'Something went wrong with billing. Please try again.', 502)
}
