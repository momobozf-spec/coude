import 'server-only'

import type { Plan } from '@prisma/client'
import type { Actor } from '@/server/auth/actor'
import { EntitlementError } from '@/lib/errors'
import { PLAN_LIMITS, type PlanLimits } from '@/config/plans'

/**
 * Feature entitlements.
 *
 * This is the ONLY place in the codebase allowed to decide what a plan unlocks.
 * Nothing else may branch on `plan === 'PREMIUM'`. The UI shows locks for
 * affordance; this module is the actual gate, and it runs on the server.
 */

export const ENTITLEMENTS = {
  'habits.unlimited': ['PREMIUM'],
  'planner.monthView': ['PREMIUM'],
  'deals.premium': ['PREMIUM'],
  'assistant.generators': ['PREMIUM'],
  'stats.fullHistory': ['PREMIUM'],
  'data.export': ['PREMIUM'],
  'templates.all': ['PREMIUM'],
  'favorites.unlimited': ['PREMIUM'],
} as const satisfies Record<string, readonly Plan[]>

export type Feature = keyof typeof ENTITLEMENTS

export function hasEntitlement(actor: Pick<Actor, 'plan'>, feature: Feature): boolean {
  return (ENTITLEMENTS[feature] as readonly Plan[]).includes(actor.plan)
}

/**
 * Throw unless the actor may use `feature`.
 *
 * `unless` lets a free user stay within a quota without holding the entitlement —
 * e.g. three habits are allowed on Free, the fourth requires `habits.unlimited`.
 */
export function requireEntitlement(
  actor: Pick<Actor, 'plan'>,
  feature: Feature,
  options: { unless?: boolean; message?: string } = {},
): void {
  if (options.unless) return
  if (hasEntitlement(actor, feature)) return
  throw new EntitlementError(feature, options.message)
}

export function limitsFor(actor: Pick<Actor, 'plan'>): PlanLimits {
  return PLAN_LIMITS[actor.plan]
}

/**
 * Whether a count is still within a plan limit. `null` limits mean unlimited.
 * Compares against the *current* count, so callers pass the count before insert.
 */
export function withinLimit(current: number, limit: number | null): boolean {
  return limit === null || current < limit
}
