import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/types';

/**
 * Toegangsrechten.
 *
 * **Uitsluitend server-side.** De client mag `entitlements` lezen maar nooit
 * schrijven (zie de RLS-policies); het toekennen gebeurt in de Stripe-webhook
 * en in `grantFreeTier`. Elke functie die geld kost, roept `checkFeature` aan
 * vóór ze iets doet — niet nadat de UI de knop al getoond heeft.
 */

export type Feature =
  | 'CHECK_IN_REPORT'
  | 'CHECK_OUT_ANALYSIS'
  | 'DEPOSIT_DOSSIER'
  | 'CONTRACT_SCAN'
  | 'ASSISTANT'
  | 'RENT_AUDIT';

export type EntitlementSource =
  | 'FREE_TIER'
  | 'SUBSCRIPTION'
  | 'ONE_OFF'
  | 'NONE';

export interface EntitlementResult {
  allowed: boolean;
  source: EntitlementSource;
  /** Welke formule dit zou ontgrendelen, wanneer het niet is toegestaan. */
  suggestedPlan: string | null;
}

const DENIED = (suggestedPlan: string | null): EntitlementResult => ({
  allowed: false,
  source: 'NONE',
  suggestedPlan,
});

type Client = SupabaseClient<Database>;

async function hasActiveSubscription(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('user_id', userId)
    .maybeSingle();

  return (
    data?.subscription_status === 'ACTIVE' ||
    data?.subscription_status === 'TRIALING'
  );
}

async function hasOneOff(
  supabase: Client,
  userId: string,
  planKey: string,
  propertyId: string | null,
): Promise<boolean> {
  if (!propertyId) return false;

  const { data } = await supabase
    .from('entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_key', planKey)
    .eq('property_id', propertyId)
    .is('revoked_at', null)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Het eerste intrekdossier is gratis, voor één woning.
 *
 * Bewust: wie net verhuisd is, is nog geen klant. Als hij pas bij het vertrek
 * moet betalen, heeft hij op dat moment ook echt iets aan ons — en anders heeft
 * hij tenminste zijn intrekfoto's.
 */
async function hasFreeCheckIn(
  supabase: Client,
  userId: string,
  propertyId: string | null,
): Promise<boolean> {
  if (!propertyId) return false;

  const { data } = await supabase
    .from('entitlements')
    .select('property_id')
    .eq('user_id', userId)
    .eq('plan_key', 'free_checkin')
    .is('revoked_at', null);

  if (!data || data.length === 0) return false;
  return data.some((row) => row.property_id === propertyId);
}

export async function checkFeature(
  supabase: Client,
  userId: string,
  feature: Feature,
  propertyId: string | null = null,
): Promise<EntitlementResult> {
  if (await hasActiveSubscription(supabase, userId)) {
    return { allowed: true, source: 'SUBSCRIPTION', suggestedPlan: null };
  }

  const relocation = await hasOneOff(
    supabase,
    userId,
    'relocation_pass',
    propertyId,
  );
  if (relocation) {
    return { allowed: true, source: 'ONE_OFF', suggestedPlan: null };
  }

  switch (feature) {
    case 'CHECK_IN_REPORT': {
      if (await hasFreeCheckIn(supabase, userId, propertyId)) {
        return { allowed: true, source: 'FREE_TIER', suggestedPlan: null };
      }
      return DENIED('relocation_pass');
    }

    case 'CHECK_OUT_ANALYSIS':
    case 'DEPOSIT_DOSSIER': {
      if (await hasOneOff(supabase, userId, 'deposit_recovery', propertyId)) {
        return { allowed: true, source: 'ONE_OFF', suggestedPlan: null };
      }
      return DENIED('deposit_recovery');
    }

    case 'CONTRACT_SCAN':
    case 'ASSISTANT':
    case 'RENT_AUDIT':
      return DENIED('tenant_protect');
  }
}

/**
 * Kent het gratis intrekdossier toe, voor één woning per gebruiker.
 *
 * Idempotent: een tweede aanroep voor dezelfde woning verandert niets, en een
 * aanroep voor een tweede woning kent niets toe.
 */
export async function grantFreeCheckIn(
  supabase: Client,
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('entitlements')
    .select('id, property_id')
    .eq('user_id', userId)
    .eq('plan_key', 'free_checkin')
    .is('revoked_at', null);

  if (existing && existing.length > 0) {
    return existing.some((row) => row.property_id === propertyId);
  }

  const { error } = await supabase.from('entitlements').insert({
    user_id: userId,
    plan_key: 'free_checkin',
    property_id: propertyId,
    source: 'FREE_TIER',
  });

  return !error;
}
