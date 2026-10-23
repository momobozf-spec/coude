import type { Plan } from '@/generated/prisma/client'

import {
  FEATURES,
  PLANS,
  lowestPlanWithFeature,
  PAID_PLANS_AVAILABLE,
  type Feature,
  type LimitKey,
  type LimitValue,
} from '@/config/plans'
import { EntitlementError } from '@/lib/errors'

/**
 * The one place that decides what a plan may do (§44).
 *
 * Nothing else in the codebase writes `if (plan === 'PLUS')`. Callers ask
 * `canUseFeature(subject, 'MULTI_CURRENCY')` or `assertWithinLimit(...)`, so
 * changing a tier is a change to `src/config/plans.ts` and nothing more.
 *
 * The functions take a `PlanSubject` rather than an `Actor` so they can also gate
 * an organization, and so tests can pass a bare `{ plan }`.
 */

export interface PlanSubject {
  plan: Plan
}

export function planOf(subject: PlanSubject) {
  return PLANS[subject.plan]
}

export function canUseFeature(subject: PlanSubject, feature: Feature): boolean {
  return planOf(subject).features.includes(feature)
}

/** Throw a 402 carrying the plan that would unlock the feature. */
export function assertFeature(subject: PlanSubject, feature: Feature): void {
  if (canUseFeature(subject, feature)) return

  const requiredPlan = lowestPlanWithFeature(feature)
  throw new EntitlementError(
    requiredPlan
      ? PAID_PLANS_AVAILABLE
        ? `Deze functie zit in ${PLANS[requiredPlan].name}.`
        : `Deze functie zit in ${PLANS[requiredPlan].name}. Betaalde abonnementen zijn nog niet beschikbaar.`
      : 'Deze functie is niet beschikbaar in jouw abonnement.',
    { feature, requiredPlan },
  )
}

/** `null` means unlimited. */
export function getLimit(subject: PlanSubject, key: LimitKey): LimitValue {
  return planOf(subject).limits[key]
}

export function isUnlimited(subject: PlanSubject, key: LimitKey): boolean {
  return getLimit(subject, key) === null
}

/**
 * Whether one more of `key` fits. `currentCount` is what already exists, so this
 * answers "may I add the next one".
 */
export function hasRemaining(subject: PlanSubject, key: LimitKey, currentCount: number): boolean {
  const limit = getLimit(subject, key)
  return limit === null || currentCount < limit
}

/** How many more are allowed. `null` = unlimited. */
export function remaining(
  subject: PlanSubject,
  key: LimitKey,
  currentCount: number,
): number | null {
  const limit = getLimit(subject, key)
  if (limit === null) return null
  return Math.max(0, limit - currentCount)
}

const LIMIT_LABELS: Record<LimitKey, string> = {
  calculationsPerYear: 'Zakat-berekeningen per jaar',
  assets: 'vermogensposten',
  liabilities: 'verplichtingen',
  favorites: 'favoriete goede doelen',
  householdMembers: 'huishoudleden',
  aiMessagesPerMonth: 'AI-berichten per maand',
  customReminders: 'eigen herinneringen',
}

/** The plan a subject would need to exceed their current allowance for `key`. */
export function nextPlanForLimit(subject: PlanSubject, key: LimitKey): Plan | null {
  const current = getLimit(subject, key)
  const better = (['PLUS', 'FAMILY', 'ORGANIZATION'] as const).find((plan) => {
    const candidate = PLANS[plan].limits[key]
    if (candidate === null) return current !== null
    return current !== null && candidate > current
  })
  return better ?? null
}

/** Throw a 402 unless one more of `key` fits within the plan. */
export function assertWithinLimit(
  subject: PlanSubject,
  key: LimitKey,
  currentCount: number,
): void {
  if (hasRemaining(subject, key, currentCount)) return

  const limit = getLimit(subject, key)
  throw new EntitlementError(
    `Je ${PLANS[subject.plan].name}-abonnement staat ${limit} ${LIMIT_LABELS[key]} toe.`,
    { limitKey: key, requiredPlan: nextPlanForLimit(subject, key) },
  )
}

/**
 * Everything the client needs to render gates without shipping the plan table:
 * a flat map of feature → allowed, plus the raw limits.
 */
export interface EntitlementSnapshot {
  plan: Plan
  planName: string
  features: Record<Feature, boolean>
  limits: Record<LimitKey, LimitValue>
}

export function entitlementSnapshot(subject: PlanSubject): EntitlementSnapshot {
  const definition = planOf(subject)

  const features = Object.fromEntries(
    FEATURES.map((f) => [f, definition.features.includes(f)]),
  ) as Record<Feature, boolean>

  return {
    plan: definition.id,
    planName: definition.name,
    features,
    limits: { ...definition.limits },
  }
}
