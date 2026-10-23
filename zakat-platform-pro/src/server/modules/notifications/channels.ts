import type { NotificationChannel as ChannelName, NotificationEvent } from '@/generated/prisma/client'

/**
 * Notification delivery adapters (§15, §16).
 *
 * Phase 5 ships **in-app only**. Email, push and Telegram exist here as declared
 * but unavailable adapters: they throw rather than silently succeeding, so a
 * preference toggle can never make the product claim a message was sent when
 * nothing left the building.
 *
 * When a real provider is wired up, it replaces the stub and nothing else in the
 * pipeline changes.
 */

export interface NotificationDeliveryInput {
  userId: string
  event: NotificationEvent
  title: string
  body?: string | null
  href?: string | null
  /** Idempotency key; the in-app adapter passes it straight to the database. */
  dedupeKey?: string | null
  reminderId?: string | null
  occurrenceAt?: Date | null
}

export interface NotificationDeliveryResult {
  channel: ChannelName
  delivered: boolean
  /** Set when an identical delivery already existed (§22). */
  deduplicated: boolean
  notificationId?: string
  error?: string
}

export interface NotificationChannelAdapter {
  readonly channel: ChannelName
  /** False for adapters that are declared but not yet implemented. */
  readonly available: boolean
  send(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult>
}

export class ChannelUnavailableError extends Error {
  constructor(channel: ChannelName) {
    super(
      `Het kanaal ${channel} is nog niet geconfigureerd. Er is geen bericht verzonden.`,
    )
    this.name = 'ChannelUnavailableError'
  }
}

/**
 * A declared-but-unimplemented channel.
 *
 * Fails loudly for the same reason the metal-price and storage providers do: a
 * silent no-op would leave a user believing they were reminded.
 */
export class UnavailableChannel implements NotificationChannelAdapter {
  readonly available = false

  constructor(readonly channel: ChannelName) {}

  async send(): Promise<NotificationDeliveryResult> {
    throw new ChannelUnavailableError(this.channel)
  }
}
