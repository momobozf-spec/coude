/**
 * Abonnementen en feature flags.
 *
 * Betalingen zijn nog niet geïmplementeerd — dat is bewust. Wat er wél is: één
 * plek waar staat wat elk plan mag, en één functie (`can`) waarmee de rest van
 * de applicatie dat vraagt. Zo is het aanzetten van betalingen later een
 * kwestie van `User.plan` bijwerken, niet van elke pagina langsgaan om er een
 * check in te bouwen.
 */
import { SubscriptionPlan } from '@prisma/client'

export type Feature =
  | 'unlimited_searches'
  | 'realtime_alerts'
  | 'property_comparison'
  | 'ai_journey_assistant'
  | 'document_vault'
  | 'neighborhood_analysis'
  | 'advanced_financing_comparison'
  | 'partner_services'

export interface PlanDefinition {
  plan: SubscriptionPlan
  label: string
  /** null = onbeperkt. */
  maxActiveSearches: number | null
  maxSavedProperties: number | null
  maxDocuments: number | null
  features: readonly Feature[]
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: {
    plan: SubscriptionPlan.FREE,
    label: 'Gratis',
    maxActiveSearches: 1,
    maxSavedProperties: 10,
    maxDocuments: 5,
    features: [],
  },
  PLUS: {
    plan: SubscriptionPlan.PLUS,
    label: 'Plus',
    maxActiveSearches: null,
    maxSavedProperties: null,
    maxDocuments: 100,
    features: [
      'unlimited_searches',
      'realtime_alerts',
      'property_comparison',
      'ai_journey_assistant',
      'document_vault',
      'neighborhood_analysis',
    ],
  },
  PREMIUM: {
    plan: SubscriptionPlan.PREMIUM,
    label: 'Premium',
    maxActiveSearches: null,
    maxSavedProperties: null,
    maxDocuments: null,
    features: [
      'unlimited_searches',
      'realtime_alerts',
      'property_comparison',
      'ai_journey_assistant',
      'document_vault',
      'neighborhood_analysis',
      'advanced_financing_comparison',
      'partner_services',
    ],
  },
}

export function can(plan: SubscriptionPlan, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature)
}

export interface LimitCheck {
  allowed: boolean
  limit: number | null
  current: number
  message?: string
}

export function checkLimit(
  plan: SubscriptionPlan,
  limitKey: 'maxActiveSearches' | 'maxSavedProperties' | 'maxDocuments',
  current: number,
): LimitCheck {
  const limit = PLANS[plan][limitKey]
  if (limit === null) return { allowed: true, limit: null, current }

  return {
    allowed: current < limit,
    limit,
    current,
    message:
      current < limit
        ? undefined
        : `Je ${PLANS[plan].label}-plan staat er ${limit} toe. Upgrade voor meer.`,
  }
}
