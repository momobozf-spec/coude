import type { ServerEnv } from '@/lib/env';

/**
 * Betaalde formules.
 *
 * De **bedragen** staan niet in de code: Stripe rekent af met de Price-ID uit
 * de omgeving, en de app toont het bedrag uit `pricing_config` (migratie
 * `20260829000003_reference_data.sql`). Die referentiebedragen zijn nog te
 * bevestigen door de eigenaar; houd ze gelijk met de prijzen in Stripe.
 */
export type PaidPlanKey = 'deposit_recovery' | 'relocation_pass' | 'tenant_protect';

export type PlanKind = 'ONE_OFF' | 'SUBSCRIPTION';

export interface PaidPlan {
  key: PaidPlanKey;
  kind: PlanKind;
  /** Eenmalige pakketten gelden voor precies één woning. */
  perProperty: boolean;
  priceEnv: keyof Pick<
    ServerEnv,
    | 'STRIPE_PRICE_DEPOSIT_RECOVERY'
    | 'STRIPE_PRICE_RELOCATION_PASS'
    | 'STRIPE_PRICE_TENANT_PROTECT'
  >;
}

export const PAID_PLANS: Record<PaidPlanKey, PaidPlan> = {
  deposit_recovery: {
    key: 'deposit_recovery',
    kind: 'ONE_OFF',
    perProperty: true,
    priceEnv: 'STRIPE_PRICE_DEPOSIT_RECOVERY',
  },
  relocation_pass: {
    key: 'relocation_pass',
    kind: 'ONE_OFF',
    perProperty: true,
    priceEnv: 'STRIPE_PRICE_RELOCATION_PASS',
  },
  tenant_protect: {
    key: 'tenant_protect',
    kind: 'SUBSCRIPTION',
    perProperty: false,
    priceEnv: 'STRIPE_PRICE_TENANT_PROTECT',
  },
};

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return typeof value === 'string' && Object.hasOwn(PAID_PLANS, value);
}

export function stripePriceFor(
  plan: PaidPlanKey,
  env: Partial<ServerEnv>,
): string | null {
  return env[PAID_PLANS[plan].priceEnv] ?? null;
}

/**
 * Formules die vandaag te koop zijn: Stripe is geconfigureerd, er is een
 * Price-ID, en — voor het abonnement — de feature-flag staat aan.
 */
export function purchasablePlans(env: Partial<ServerEnv>): PaidPlanKey[] {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return [];

  return (Object.keys(PAID_PLANS) as PaidPlanKey[]).filter((key) => {
    if (!stripePriceFor(key, env)) return false;
    if (key === 'tenant_protect') {
      return env.FEATURE_TENANT_PROTECT_SUBSCRIPTION === true;
    }
    return true;
  });
}
