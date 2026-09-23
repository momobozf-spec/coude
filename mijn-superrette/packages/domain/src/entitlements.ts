/**
 * Entitlements are server-configurable. The code only knows the *keys*;
 * which plan grants what (and limits such as the number of alerts) lives
 * in the database (plan_entitlements) so business rules can change without
 * an app release.
 */
export const ENTITLEMENT_KEYS = [
  'search',
  'basic_comparison',
  'shopping_lists',
  'basket_comparison',
  'advanced_basket_comparison',
  'price_alerts',
  'price_history',
  'smart_basket',
  'shared_lists',
  'advanced_filters',
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export interface EntitlementGrant {
  key: EntitlementKey;
  enabled: boolean;
  /** Optional numeric limit, e.g. max price alerts. null = unlimited. */
  limit: number | null;
}

export type EntitlementSet = Record<EntitlementKey, EntitlementGrant>;

export function emptyEntitlements(): EntitlementSet {
  const result = {} as EntitlementSet;
  for (const key of ENTITLEMENT_KEYS) result[key] = { key, enabled: false, limit: 0 };
  return result;
}

/** Merge grants: enabled wins, and the most generous limit wins (null = unlimited). */
export function mergeEntitlements(...sets: EntitlementGrant[][]): EntitlementSet {
  const result = emptyEntitlements();
  for (const grants of sets) {
    for (const grant of grants) {
      const current = result[grant.key];
      if (!grant.enabled) continue;
      const limit = !current.enabled
        ? grant.limit
        : current.limit === null || grant.limit === null
          ? null
          : Math.max(current.limit, grant.limit);
      result[grant.key] = { key: grant.key, enabled: true, limit };
    }
  }
  return result;
}

export function isWithinLimit(grant: EntitlementGrant, currentUsage: number): boolean {
  if (!grant.enabled) return false;
  return grant.limit === null || currentUsage < grant.limit;
}
