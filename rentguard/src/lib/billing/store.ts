import type { SupabaseClient } from '@supabase/supabase-js';

import type { BillingStore, GrantResult } from '@/lib/billing/webhook';
import type { Database } from '@/lib/supabase/types';

/**
 * Supabase-implementatie van de webhookopslag.
 *
 * Werkt uitsluitend met de **service role**: `stripe_events` heeft geen enkele
 * client-policy en `entitlements` kan door de client niet beschreven worden.
 */

const UNIQUE_VIOLATION = '23505';

export function createSupabaseBillingStore(
  admin: SupabaseClient<Database>,
): BillingStore {
  return {
    async recordEvent({ id, type, payload }) {
      const { error } = await admin.from('stripe_events').insert({
        id,
        type,
        payload: payload as Record<string, unknown>,
      });

      if (!error) return 'NEW';
      if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

      const { data, error: readError } = await admin
        .from('stripe_events')
        .select('processed_at')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);

      return data?.processed_at ? 'ALREADY_PROCESSED' : 'RETRY';
    },

    async markProcessed(eventId, note) {
      const { error } = await admin
        .from('stripe_events')
        .update({ processed_at: new Date().toISOString(), error: note ?? null })
        .eq('id', eventId);
      if (error) throw new Error(error.message);
    },

    async markFailed(eventId, message) {
      await admin
        .from('stripe_events')
        .update({ error: message.slice(0, 2000) })
        .eq('id', eventId);
    },

    async getPropertyOwner(propertyId) {
      const { data, error } = await admin
        .from('properties')
        .select('user_id')
        .eq('id', propertyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.user_id ?? null;
    },

    async grantStripeEntitlement({ userId, planKey, propertyId, checkoutSessionId }) {
      const { data: existing, error: readError } = await admin
        .from('entitlements')
        .select('id')
        .eq('stripe_checkout_session_id', checkoutSessionId)
        .limit(1);
      if (readError) throw new Error(readError.message);
      if ((existing?.length ?? 0) > 0) return 'ALREADY_GRANTED' satisfies GrantResult;

      const { error } = await admin.from('entitlements').insert({
        user_id: userId,
        plan_key: planKey,
        property_id: propertyId,
        source: 'STRIPE',
        stripe_checkout_session_id: checkoutSessionId,
      });

      if (!error) return 'GRANTED';
      if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

      // Ofwel een gelijktijdige levering van hetzelfde event (sessie-ID uniek),
      // ofwel al een actief pakket voor deze woning (partiële unieke index).
      const { data: again } = await admin
        .from('entitlements')
        .select('id')
        .eq('stripe_checkout_session_id', checkoutSessionId)
        .limit(1);
      return (again?.length ?? 0) > 0 ? 'ALREADY_GRANTED' : 'DUPLICATE_ACTIVE';
    },

    async revokeByCheckoutSession(checkoutSessionId) {
      const { data, error } = await admin
        .from('entitlements')
        .update({ revoked_at: new Date().toISOString() })
        .eq('stripe_checkout_session_id', checkoutSessionId)
        .is('revoked_at', null)
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },

    async linkCustomer(userId, customerId) {
      const { error } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId)
        .is('stripe_customer_id', null);
      if (error) throw new Error(error.message);
    },

    async findUserIdByCustomer(customerId) {
      const { data, error } = await admin
        .from('profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.user_id ?? null;
    },

    async updateSubscription({ userId, customerId, status, currentPeriodEnd }) {
      const update: Database['public']['Tables']['profiles']['Update'] = {
        subscription_status: status,
        subscription_current_period_end: currentPeriodEnd,
      };
      const { error } = await admin.from('profiles').update(update).eq('user_id', userId);
      if (error) throw new Error(error.message);
      if (customerId) {
        await admin
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', userId)
          .is('stripe_customer_id', null);
      }
    },
  };
}
