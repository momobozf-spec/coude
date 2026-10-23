import type { Plan } from '@/generated/prisma/client'

/**
 * Plan definitions, feature flags and limits (§43, §44).
 *
 * This is the single source of truth. Nothing outside this file may branch on a
 * plan name — call `canUseFeature()` / `getLimit()` from
 * `src/server/services/entitlements.ts` instead.
 */

export const FEATURES = [
  'UNLIMITED_CALCULATIONS',
  'CALCULATION_HISTORY',
  'ADVANCED_ASSETS',
  'MULTI_CURRENCY',
  'BUSINESS_ASSETS',
  'YEARLY_REPORTS',
  'REPORT_EXPORT',
  'AI_EXPLANATIONS',
  'AI_ASSISTANT',
  'RECEIPT_UPLOAD',
  'HOUSEHOLD',
  'HOUSEHOLD_SHARED_DASHBOARD',
  'CUSTOM_REMINDERS',
  'ORGANIZATION_TEAM',
  'AUDIT_EXPORT',
] as const

export type Feature = (typeof FEATURES)[number]

export const LIMITS = [
  /** Finalised calculations per calendar year. */
  'calculationsPerYear',
  /** Active (non-archived) assets. */
  'assets',
  /** Active liabilities. */
  'liabilities',
  /** Favourited charities. */
  'favorites',
  /** Members in a household, the owner included. */
  'householdMembers',
  /** AI assistant messages per calendar month. */
  'aiMessagesPerMonth',
  /** Custom (non-Zakat) reminders. */
  'customReminders',
] as const

export type LimitKey = (typeof LIMITS)[number]

/** `null` means unlimited. */
export type LimitValue = number | null

export interface PlanDefinition {
  id: Plan
  name: string
  description: string
  features: readonly Feature[]
  limits: Record<LimitKey, LimitValue>
}

const FREE_LIMITS: Record<LimitKey, LimitValue> = {
  calculationsPerYear: 1,
  assets: 10,
  liabilities: 5,
  favorites: 5,
  householdMembers: 0,
  aiMessagesPerMonth: 0,
  customReminders: 0,
}

const PLUS_LIMITS: Record<LimitKey, LimitValue> = {
  calculationsPerYear: null,
  assets: null,
  liabilities: null,
  favorites: null,
  householdMembers: 0,
  aiMessagesPerMonth: 200,
  customReminders: 20,
}

const FAMILY_LIMITS: Record<LimitKey, LimitValue> = {
  ...PLUS_LIMITS,
  householdMembers: 6,
  aiMessagesPerMonth: 400,
}

const ORGANIZATION_LIMITS: Record<LimitKey, LimitValue> = {
  ...PLUS_LIMITS,
  householdMembers: 25,
  aiMessagesPerMonth: 1000,
  customReminders: null,
}

const FREE_FEATURES = [] as const

const PLUS_FEATURES = [
  'UNLIMITED_CALCULATIONS',
  'CALCULATION_HISTORY',
  'ADVANCED_ASSETS',
  'MULTI_CURRENCY',
  'BUSINESS_ASSETS',
  'YEARLY_REPORTS',
  'REPORT_EXPORT',
  'AI_EXPLANATIONS',
  'AI_ASSISTANT',
  'RECEIPT_UPLOAD',
  'CUSTOM_REMINDERS',
] as const

const FAMILY_FEATURES = [...PLUS_FEATURES, 'HOUSEHOLD', 'HOUSEHOLD_SHARED_DASHBOARD'] as const

const ORGANIZATION_FEATURES = [...FAMILY_FEATURES, 'ORGANIZATION_TEAM', 'AUDIT_EXPORT'] as const

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Gratis',
    description: 'Eén Zakat-berekening per jaar, je basisvermogen en de goede-doelengids.',
    features: FREE_FEATURES,
    limits: FREE_LIMITS,
  },
  PLUS: {
    id: 'PLUS',
    name: 'Plus',
    description: 'Onbeperkt berekenen, volledige historie, meerdere valuta en jaarrapporten.',
    features: PLUS_FEATURES,
    limits: PLUS_LIMITS,
  },
  FAMILY: {
    id: 'FAMILY',
    name: 'Familie',
    description: 'Alles van Plus, plus een gedeeld huishouden met tot zes leden.',
    features: FAMILY_FEATURES,
    limits: FAMILY_LIMITS,
  },
  ORGANIZATION: {
    id: 'ORGANIZATION',
    name: 'Organisatie',
    description: 'Voor moskeeën, stichtingen en bedrijven. Teamaccounts en audittools.',
    features: ORGANIZATION_FEATURES,
    limits: ORGANIZATION_LIMITS,
  },
}

export const PLAN_ORDER: readonly Plan[] = ['FREE', 'PLUS', 'FAMILY', 'ORGANIZATION']

/**
 * Kunnen betaalde plannen gekocht worden?
 *
 * v1 lanceert gratis: er is geen betaalprovider geïmplementeerd en er zijn geen
 * prijzen. Zolang dit `false` is, toont de app Plus/Familie/Organisatie nooit
 * als iets wat je kunt kopen (geen prijs, geen knop, "nog niet beschikbaar").
 * Pas op `true` zetten in dezelfde wijziging die een betaalprovider (checkout +
 * webhook) en prijzen toevoegt.
 */
export const PAID_PLANS_AVAILABLE = false as boolean

/**
 * The cheapest plan that includes a feature — used to tell the user *which*
 * upgrade unlocks what they just tried to do, rather than a bare "upgrade".
 */
export function lowestPlanWithFeature(feature: Feature): Plan | null {
  return PLAN_ORDER.find((plan) => PLANS[plan].features.includes(feature)) ?? null
}
