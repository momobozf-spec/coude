import type { NotificationChannel } from '@prisma/client'

/**
 * The complete set of things this product may notify someone about.
 *
 * It is short on purpose. A notification is an interruption, and this is an app
 * about worship and attention — the bar for earning one is high. There is no
 * generic `send(anything)`: adding a reason to interrupt someone means adding an
 * entry here, in a diff someone reviews.
 *
 * Deliberately absent, and to stay absent:
 *  - "You haven't prayed Asr yet" — the app does not police worship.
 *  - Streak-loss warnings of any kind.
 *  - Re-engagement nudges to inactive members. If someone stopped using it, the
 *    answer is a better product, not a push notification.
 *  - Anything about another member's activity.
 */

export const NOTIFICATION_TYPES = {
  /** A prayer time is approaching. Opt-in, per prayer, off by default. */
  PRAYER_REMINDER: 'PRAYER_REMINDER',
  /** A habit the member scheduled for a specific time is due. Opt-in. */
  HABIT_REMINDER: 'HABIT_REMINDER',
  /** A planner block starts soon. Opt-in. */
  PLANNER_BLOCK_STARTING: 'PLANNER_BLOCK_STARTING',
  /** The weekly review is ready. Opt-in. */
  WEEKLY_REVIEW_READY: 'WEEKLY_REVIEW_READY',
  /** A renewal failed. Transactional — the member's money is involved. */
  BILLING_PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',
  /** A subscription ended or was cancelled. Transactional. */
  BILLING_SUBSCRIPTION_ENDED: 'BILLING_SUBSCRIPTION_ENDED',
  /** A data export finished. Transactional — they asked for it. */
  DATA_EXPORT_READY: 'DATA_EXPORT_READY',
  /** Account deletion was requested. Transactional, and a security signal. */
  ACCOUNT_DELETION_REQUESTED: 'ACCOUNT_DELETION_REQUESTED',
  /** Account deletion completed. Transactional. */
  ACCOUNT_DELETION_COMPLETED: 'ACCOUNT_DELETION_COMPLETED',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export interface NotificationDefinition {
  type: NotificationType
  /**
   * Transactional notifications concern money, security or an explicit request.
   * They ignore marketing-style preferences because suppressing them would leave
   * someone unaware that their card failed — but they still respect channel
   * availability, and are never sent to a deleted account.
   */
  transactional: boolean
  /** Channels this type may ever use. A subset is chosen per member. */
  allowedChannels: readonly NotificationChannel[]
  /** Channels enabled when a member has expressed no preference. */
  defaultChannels: readonly NotificationChannel[]
  /** Translation key prefix; `.title` and `.body` must both exist. */
  messageKey: string
}

export const NOTIFICATION_DEFINITIONS: Record<NotificationType, NotificationDefinition> = {
  PRAYER_REMINDER: {
    type: 'PRAYER_REMINDER',
    transactional: false,
    allowedChannels: ['IN_APP', 'PUSH'],
    // Off by default. An unrequested prayer reminder is exactly the guilt
    // mechanic this product refuses to ship.
    defaultChannels: [],
    messageKey: 'notifications.prayerReminder',
  },
  HABIT_REMINDER: {
    type: 'HABIT_REMINDER',
    transactional: false,
    allowedChannels: ['IN_APP', 'PUSH'],
    defaultChannels: [],
    messageKey: 'notifications.habitReminder',
  },
  PLANNER_BLOCK_STARTING: {
    type: 'PLANNER_BLOCK_STARTING',
    transactional: false,
    allowedChannels: ['IN_APP', 'PUSH'],
    defaultChannels: [],
    messageKey: 'notifications.plannerBlockStarting',
  },
  WEEKLY_REVIEW_READY: {
    type: 'WEEKLY_REVIEW_READY',
    transactional: false,
    allowedChannels: ['IN_APP', 'PUSH', 'EMAIL'],
    defaultChannels: ['IN_APP'],
    messageKey: 'notifications.weeklyReviewReady',
  },
  BILLING_PAYMENT_FAILED: {
    type: 'BILLING_PAYMENT_FAILED',
    transactional: true,
    allowedChannels: ['IN_APP', 'EMAIL'],
    defaultChannels: ['IN_APP', 'EMAIL'],
    messageKey: 'notifications.billingPaymentFailed',
  },
  BILLING_SUBSCRIPTION_ENDED: {
    type: 'BILLING_SUBSCRIPTION_ENDED',
    transactional: true,
    allowedChannels: ['IN_APP', 'EMAIL'],
    defaultChannels: ['IN_APP', 'EMAIL'],
    messageKey: 'notifications.billingSubscriptionEnded',
  },
  DATA_EXPORT_READY: {
    type: 'DATA_EXPORT_READY',
    transactional: true,
    allowedChannels: ['IN_APP', 'EMAIL'],
    defaultChannels: ['IN_APP'],
    messageKey: 'notifications.dataExportReady',
  },
  ACCOUNT_DELETION_REQUESTED: {
    type: 'ACCOUNT_DELETION_REQUESTED',
    transactional: true,
    allowedChannels: ['IN_APP', 'EMAIL'],
    defaultChannels: ['IN_APP', 'EMAIL'],
    messageKey: 'notifications.accountDeletionRequested',
  },
  ACCOUNT_DELETION_COMPLETED: {
    type: 'ACCOUNT_DELETION_COMPLETED',
    transactional: true,
    // In-app is pointless once the account is gone; email is the only channel
    // that can still reach the person.
    allowedChannels: ['EMAIL'],
    defaultChannels: ['EMAIL'],
    messageKey: 'notifications.accountDeletionCompleted',
  },
}

/**
 * Variables a notification body may interpolate.
 *
 * Same rule as analytics, for the same reason: what goes in here is rendered
 * into a message that may leave the system and sit in a mailbox. Numbers and
 * closed enums only — never a habit name, a task title or reflection text.
 */
export type NotificationVariables = Record<string, number | string>

/** Variable keys allowed per type. Anything else is a programming error. */
export const NOTIFICATION_VARIABLES: Record<NotificationType, readonly string[]> = {
  // `prayer` is one of the five names — a closed set, not user content.
  PRAYER_REMINDER: ['prayer', 'minutes'],
  HABIT_REMINDER: ['minutes'],
  PLANNER_BLOCK_STARTING: ['minutes'],
  WEEKLY_REVIEW_READY: ['weekNumber'],
  BILLING_PAYMENT_FAILED: ['graceDays'],
  BILLING_SUBSCRIPTION_ENDED: [],
  DATA_EXPORT_READY: [],
  ACCOUNT_DELETION_REQUESTED: ['graceDays'],
  ACCOUNT_DELETION_COMPLETED: [],
}
