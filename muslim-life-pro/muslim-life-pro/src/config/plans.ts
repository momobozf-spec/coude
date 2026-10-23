/**
 * Plan definitions and limits.
 *
 * This is the single source of truth for what each tier includes. The entitlement
 * service (src/server/services/entitlements.ts) is the only thing allowed to read
 * it for gating decisions — UI reads it for display only.
 */

export type PlanId = 'FREE' | 'PREMIUM'

export interface PlanLimits {
  /**
   * Active non-prayer habits. `null` = unlimited.
   * Prayer is a separate model and never counts against this.
   */
  maxHabits: number | null
  /** Saved businesses + deals. `null` = unlimited. */
  maxFavorites: number | null
  /** AI messages per calendar month. */
  aiMessagesPerMonth: number
  /** AI structured plan generations per calendar month. */
  aiGeneratorsPerMonth: number
  /** Days of habit history shown in statistics. `null` = full history. */
  statsHistoryDays: number | null
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    maxHabits: 5,
    maxFavorites: 10,
    aiMessagesPerMonth: 10,
    aiGeneratorsPerMonth: 0,
    statsHistoryDays: 7,
  },
  PREMIUM: {
    maxHabits: null,
    maxFavorites: null,
    aiMessagesPerMonth: 500,
    aiGeneratorsPerMonth: 50,
    statsHistoryDays: null,
  },
}

export const PRICING = {
  currency: 'EUR',
  symbol: '€',
  monthly: { amount: 799, display: '7.99', interval: 'MONTHLY' as const },
  yearly: { amount: 7900, display: '79', interval: 'YEARLY' as const },
  /** Rounded saving shown on the pricing toggle. */
  yearlySavingPercent: 18,
  trialDays: 7,
} as const

export interface PlanFeature {
  /** i18n key under `pricing.features`. */
  key: string
  free: string | boolean
  premium: string | boolean
}

/**
 * What the pricing table promises. Only differences the server actually
 * enforces are listed: a paid plan may not be sold on features that do not
 * exist (a month view, statistics history and template packs were listed here
 * before but are not built — they return to this table when they ship).
 */
export const PLAN_FEATURES: PlanFeature[] = [
  { key: 'prayerTimes', free: true, premium: true },
  { key: 'prayerTracking', free: true, premium: true },
  { key: 'dailyPlanner', free: true, premium: true },
  { key: 'habits', free: '5', premium: 'unlimited' },
  { key: 'deals', free: 'standard', premium: 'standardPremium' },
  { key: 'favorites', free: '10', premium: 'unlimited' },
  { key: 'aiMessages', free: '10', premium: '500' },
  { key: 'aiGenerators', free: false, premium: true },
  // A GDPR right (art. 15/20), so never a paid feature.
  { key: 'dataExport', free: true, premium: true },
  { key: 'cloudSync', free: true, premium: true },
]
