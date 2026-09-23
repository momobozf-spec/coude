import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import {
  ENTITLEMENT_KEYS,
  mergeEntitlements,
  type EntitlementGrant,
  type EntitlementKey,
  type EntitlementSet,
} from '@superrette/domain';
import type { Database } from '../client.js';
import { planEntitlements, plans, subscriptions } from '../schema/index.js';

const isKey = (k: string): k is EntitlementKey => (ENTITLEMENT_KEYS as readonly string[]).includes(k);

/**
 * Resolve a user's entitlements from the default plan plus any active
 * subscription plans. All rules live in the database.
 */
export async function resolveEntitlements(db: Database, userId: string, now = new Date()): Promise<{ plans: string[]; entitlements: EntitlementSet }> {
  const active = await db
    .select({ planKey: subscriptions.planKey })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ['ACTIVE', 'IN_GRACE_PERIOD']),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
      ),
    );
  const defaults = await db.select({ key: plans.key }).from(plans).where(eq(plans.isDefault, true));
  const planKeys = [...new Set([...defaults.map((p) => p.key), ...active.map((a) => a.planKey)])];
  if (planKeys.length === 0) return { plans: [], entitlements: mergeEntitlements() };
  const rows = await db.select().from(planEntitlements).where(inArray(planEntitlements.planKey, planKeys));
  const grants: EntitlementGrant[] = rows
    .filter((r) => isKey(r.entitlementKey))
    .map((r) => ({ key: r.entitlementKey as EntitlementKey, enabled: r.enabled, limit: r.limitValue }));
  return { plans: planKeys, entitlements: mergeEntitlements(grants) };
}
