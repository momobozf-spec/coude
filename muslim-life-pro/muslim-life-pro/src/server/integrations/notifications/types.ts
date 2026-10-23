import type { NotificationChannel } from '@prisma/client'

/**
 * Notification delivery contract.
 *
 * Same shape as the payment and AI integrations: a narrow interface the rest of
 * the app codes against, with adapters behind it. A provider receives an already
 * rendered, already permitted message — it makes no decisions about whether to
 * send, in what language, or to whom.
 */

export interface NotificationPayload {
  /** Internal user id. Never an email or a phone number. */
  userId: string
  channel: NotificationChannel
  /** Stable per (notification, channel); a provider may use it to deduplicate. */
  idempotencyKey: string
  title: string
  body: string
  /** Deep link into the app, relative to the app URL. */
  url?: string
  /**
   * Contact details, resolved by the caller only for the channel that needs
   * them. `IN_APP` carries none at all.
   */
  destination?: { email?: string; pushToken?: string }
}

export interface NotificationResult {
  /** Provider-side id, when there is one. Used for support lookups. */
  externalId: string | null
  /** True when the provider accepted it; false means a retryable failure. */
  accepted: boolean
}

export type NotificationErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_CHANNEL'
  | 'INVALID_DESTINATION'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'

export class NotificationProviderError extends Error {
  constructor(
    readonly code: NotificationErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'NotificationProviderError'
  }
}

export interface NotificationProvider {
  readonly id: string
  /** Channels this adapter can actually deliver on. */
  readonly channels: readonly NotificationChannel[]
  /** True when nothing leaves the system — surfaced in the UI as "demo". */
  readonly isStub: boolean
  send(payload: NotificationPayload): Promise<NotificationResult>
}
