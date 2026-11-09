import 'server-only'

import { isProduction } from '@/config/env'
import { logger } from '@/lib/logger'
import {
  assertSafeProperties,
  getAnalyticsSink,
  setAnalyticsSinkOverride,
  type AnalyticsSink,
  type SafeValue,
} from '@/server/integrations/analytics'

/**
 * Product analytics.
 *
 * Two hard rules, enforced by types rather than by discipline:
 *
 *  1. Only events from `ANALYTICS_EVENTS` may be recorded. There is no free-form
 *     `track(string)`.
 *  2. Properties are numbers, booleans and closed enums only. No strings that
 *     could carry user content — no task titles, no habit names, no reflection
 *     text, no prayer detail.
 *
 * The point is that we can answer "did this user come back on day 30" and
 * "how many habits does a retained user track" without ever storing what those
 * habits are. Wiring PostHog later means implementing `AnalyticsSink`; no
 * business code changes.
 */

export const ANALYTICS_EVENTS = {
  MY_DAY_OPENED: 'MY_DAY_OPENED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_PRIORITISED: 'TASK_PRIORITISED',
  HABIT_CREATED: 'HABIT_CREATED',
  HABIT_COMPLETED: 'HABIT_COMPLETED',
  HABIT_SKIPPED: 'HABIT_SKIPPED',
  PRAYER_LOGGED: 'PRAYER_LOGGED',
  PLANNER_BLOCK_CREATED: 'PLANNER_BLOCK_CREATED',
  PLANNER_CONFLICT_SHOWN: 'PLANNER_CONFLICT_SHOWN',
  REFLECTION_COMPLETED: 'REFLECTION_COMPLETED',
  WEEKLY_REVIEW_OPENED: 'WEEKLY_REVIEW_OPENED',
  EXPLORE_OPENED: 'EXPLORE_OPENED',
  BUSINESS_SEARCHED: 'BUSINESS_SEARCHED',
  BUSINESS_OPENED: 'BUSINESS_OPENED',
  DEAL_OPENED: 'DEAL_OPENED',
  BUSINESS_FAVORITED: 'BUSINESS_FAVORITED',
  DEAL_FAVORITED: 'DEAL_FAVORITED',
  DEAL_REDEMPTION_ISSUED: 'DEAL_REDEMPTION_ISSUED',
  AI_ASSISTANT_OPENED: 'AI_ASSISTANT_OPENED',
  AI_MESSAGE_SENT: 'AI_MESSAGE_SENT',
  AI_RESPONSE_COMPLETED: 'AI_RESPONSE_COMPLETED',
  AI_QUOTA_REACHED: 'AI_QUOTA_REACHED',
  GENERATED_PLAN_CREATED: 'GENERATED_PLAN_CREATED',
  GENERATED_PLAN_APPLIED: 'GENERATED_PLAN_APPLIED',
  PRICING_OPENED: 'PRICING_OPENED',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
  SUBSCRIPTION_ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_CANCEL_REQUESTED: 'SUBSCRIPTION_CANCEL_REQUESTED',
  UPGRADE_PROMPT_SHOWN: 'UPGRADE_PROMPT_SHOWN',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/**
 * Per-event property contracts.
 *
 * Note what is absent: `PRAYER_LOGGED` records *which* of the five prayers and the
 * status, because that is a closed enum with no personal content — but never a
 * timestamp precise enough to infer location, and never a note.
 */
export interface AnalyticsProperties {
  MY_DAY_OPENED: { habitCount: number; taskCount: number; hasLocation: boolean }
  TASK_CREATED: { hasSchedule: boolean; hasTime: boolean; isPriority: boolean }
  TASK_COMPLETED: { wasPriority: boolean; wasScheduled: boolean }
  TASK_PRIORITISED: { priorityCount: number }
  HABIT_CREATED: { fromTemplate: boolean; isWorship: boolean; activeCount: number }
  HABIT_COMPLETED: { isWorship: boolean; partial: boolean }
  HABIT_SKIPPED: { isWorship: boolean }
  PRAYER_LOGGED: { excused: boolean; jamaah: boolean }
  PLANNER_BLOCK_CREATED: { durationMinutes: number; hadPrayerConflict: boolean }
  PLANNER_CONFLICT_SHOWN: { resolved: boolean }
  REFLECTION_COMPLETED: { fieldsFilled: number }
  WEEKLY_REVIEW_OPENED: Record<string, never>
  EXPLORE_OPENED: { hasCity: boolean; favouriteCount: number }
  /**
   * Note what is absent: the query itself. Whether someone searched is a product
   * signal; what they searched for is their business, and "halal butcher near
   * [mosque name]" is exactly the kind of string that must never leave the row.
   */
  BUSINESS_SEARCHED: {
    hasQuery: boolean
    hasCategory: boolean
    hasCity: boolean
    resultCount: number
  }
  BUSINESS_OPENED: { isDemo: boolean; hasDeals: boolean }
  DEAL_OPENED: { isPremiumOnly: boolean; isDemo: boolean; locked: boolean }
  BUSINESS_FAVORITED: { isDemo: boolean }
  DEAL_FAVORITED: { isDemo: boolean; isPremiumOnly: boolean }
  DEAL_REDEMPTION_ISSUED: { isPremiumOnly: boolean; isDemo: boolean }

  AI_ASSISTANT_OPENED: { conversationCount: number; messagesRemaining: number }
  /**
   * Again, note the absence: no prompt text, ever. The safety classification is
   * a closed enum and is genuinely useful — it tells us how often people bring
   * religious questions to a planning tool, which is a product decision input.
   */
  AI_MESSAGE_SENT: { isGenerator: boolean; requiredDisclaimer: boolean; requiredReferral: boolean }
  AI_RESPONSE_COMPLETED: { streamed: boolean; outputTokens: number; isLiveProvider: boolean }
  AI_QUOTA_REACHED: { isGenerator: boolean; limit: number }
  GENERATED_PLAN_CREATED: { itemCount: number; duplicateCount: number; conflictCount: number }
  GENERATED_PLAN_APPLIED: { selectedCount: number; taskCount: number; blockCount: number }

  /**
   * Billing events carry no payment data: no card details, no provider customer
   * or subscription ids, no amounts tied to an individual. Only the shape of the
   * funnel, which is what a conversion rate actually needs.
   */
  PRICING_OPENED: { isSubscriber: boolean }
  CHECKOUT_STARTED: { isYearly: boolean; isLiveBilling: boolean }
  CHECKOUT_COMPLETED: { isYearly: boolean }
  SUBSCRIPTION_ACTIVATED: { isYearly: boolean; isTrial: boolean }
  SUBSCRIPTION_CANCEL_REQUESTED: Record<string, never>
  /** `feature` is a closed entitlement key, never free text. */
  UPGRADE_PROMPT_SHOWN: { atLimit: boolean }
}

/**
 * A sink supplied by a test or a caller. `id` is optional here so a test can
 * pass a bare recorder; the configured sinks always carry one.
 */
export type AnalyticsSinkOverride = { id?: string; record: AnalyticsSink['record'] }

/** Swap the sink (a capture buffer in tests, a queue later). */
export function setAnalyticsSink(next: AnalyticsSinkOverride) {
  setAnalyticsSinkOverride({ id: next.id ?? 'custom', record: next.record })
}

/** Restore environment-driven resolution. */
export function resetAnalyticsSink() {
  setAnalyticsSinkOverride(null)
}

/**
 * Record an event. Never throws and never blocks the caller's transaction — a
 * failed analytics write must not fail a habit tick.
 *
 * The one exception is a property that should never have been collected. That
 * is a programming error, not an outage, so outside production it surfaces
 * immediately rather than being logged and forgotten.
 */
export async function track<K extends AnalyticsEventName>(
  userId: string | null,
  name: K,
  properties: AnalyticsProperties[K],
): Promise<void> {
  try {
    assertSafeProperties(name, properties)
  } catch (error) {
    logger.warn('analytics.property.rejected', { event: name, error: String(error) })
    if (!isProduction) throw error
    return
  }

  try {
    await getAnalyticsSink().record(userId, name, properties as Record<string, SafeValue>)
  } catch (error) {
    logger.warn('analytics.record.failed', { event: name, error: String(error) })
  }
}
