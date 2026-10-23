import 'server-only'

import { logger } from '@/lib/logger'

/**
 * Product analytics (§29).
 *
 * Events are emitted as structured log lines and are *not* stored in a table.
 * That is the privacy-minded default from §47: we want to know that wizards get
 * abandoned at step 5, not to build a per-user behavioural record that then has
 * to be retained, secured and deleted on request.
 *
 * The payload is a closed type on purpose — there is no free-form `properties`
 * bag through which an amount could ever be attached to an event.
 */

export type ProductEvent =
  | 'ZAKAT_ONBOARDING_STARTED'
  | 'ZAKAT_ONBOARDING_COMPLETED'
  | 'ZAKAT_WIZARD_STARTED'
  | 'ZAKAT_WIZARD_STEP_COMPLETED'
  | 'ZAKAT_CALCULATION_PREVIEWED'
  | 'ZAKAT_CALCULATION_FINALIZED'
  | 'DONATION_CREATED'
  | 'ZAKAT_PAYMENT_REGISTERED'
  | 'ZAKAT_PAYMENT_COMPLETED'
  | 'DONATION_HISTORY_OPENED'
  | 'RECEIPT_UPLOADED'
  | 'SADAQAH_GOAL_CREATED'
  | 'REMINDER_CREATED'
  | 'REMINDER_COMPLETED'
  | 'NOTIFICATION_OPENED'
  | 'ANNUAL_REPORT_OPENED'
  | 'ANNUAL_REPORT_GENERATED'

export interface ProductEventContext {
  /** Which step, for funnel analysis. Never an amount. */
  step?: number
  /** Categorical only: 'GOLD' | 'SILVER' | 'CUSTOM'. */
  nisabBasis?: string
  /** Whether the result cleared the threshold — a boolean, not a figure. */
  aboveNisab?: boolean
  /** Currency code, which is not itself sensitive. */
  currency?: string
  rulesVersion?: string

  /** Categorical: 'ZAKAT' | 'SADAQAH' | … Never the amount (§29, §47). */
  donationType?: string
  /** Whether the donation settles a Zakat year — a boolean, not a figure. */
  allocated?: boolean
  /** Payment status after the event: 'PARTIALLY_PAID' | 'FULLY_PAID' | … */
  paymentStatus?: string
  /** Goal cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'. */
  period?: string
  /** Receipt MIME type, so upload failures are diagnosable. Not the filename. */
  mimeType?: string

  /** Categorical reminder type. Never the title — that is the user's own words. */
  reminderType?: string
  /** Notification event name, e.g. ZAKAT_REMINDER_DUE. */
  notificationEvent?: string
  /** Report year. A year is not sensitive; the amounts in it are (§39). */
  reportYear?: number
}

export function trackEvent(
  event: ProductEvent,
  userId: string,
  context: ProductEventContext = {},
): void {
  logger.info('analytics.event', { event, userId, ...context })
}
