import type Stripe from 'stripe';

import type { Locale } from '@/i18n/config';
import { PAID_PLANS, type PaidPlanKey } from '@/lib/billing/plans';

/**
 * Metadata die we aan elke Checkout Session hangen. De webhook leest ze terug
 * en vertrouwt ze pas na signatuurcontrole én een eigendomscontrole van de
 * woning in de databank.
 */
export interface CheckoutMetadata {
  user_id: string;
  plan_key: PaidPlanKey;
  property_id: string;
  /**
   * De consument vroeg uitdrukkelijk om onmiddellijke uitvoering en erkende
   * het verlies van het herroepingsrecht zodra de dienst volledig geleverd is
   * (WER art. VI.47 §4 en VI.53, 1° en 13°). Zonder dit vinkje start er
   * geen betaling.
   */
  withdrawal_waiver: 'accepted';
}

export interface CheckoutInput {
  plan: PaidPlanKey;
  priceId: string;
  userId: string;
  email: string;
  stripeCustomerId: string | null;
  propertyId: string | null;
  locale: Locale;
  appUrl: string;
  withdrawalWaiverAccepted: boolean;
}

export class CheckoutInputError extends Error {}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const plan = PAID_PLANS[input.plan];

  if (plan.perProperty && !input.propertyId) {
    throw new CheckoutInputError('Een eenmalig pakket vereist een woning.');
  }
  if (!input.withdrawalWaiverAccepted) {
    throw new CheckoutInputError(
      'Zonder uitdrukkelijke vraag tot onmiddellijke uitvoering starten we geen betaling.',
    );
  }

  const base = input.appUrl.replace(/\/+$/, '');
  const metadata: CheckoutMetadata = {
    user_id: input.userId,
    plan_key: input.plan,
    property_id: plan.perProperty ? (input.propertyId ?? '') : '',
    withdrawal_waiver: 'accepted',
  };
  const metadataParam: Record<string, string> = { ...metadata };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: plan.kind === 'SUBSCRIPTION' ? 'subscription' : 'payment',
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId,
    metadata: metadataParam,
    locale: input.locale,
    success_url: `${base}/${input.locale}/billing?checkout=success`,
    cancel_url: `${base}/${input.locale}/billing?checkout=cancelled`,
  };

  if (input.stripeCustomerId) {
    params.customer = input.stripeCustomerId;
  } else {
    params.customer_email = input.email;
    if (plan.kind === 'ONE_OFF') params.customer_creation = 'always';
  }

  if (plan.kind === 'SUBSCRIPTION') {
    params.subscription_data = { metadata: metadataParam };
  } else {
    params.payment_intent_data = { metadata: metadataParam };
  }

  return params;
}
