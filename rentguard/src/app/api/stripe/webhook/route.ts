import { NextResponse } from 'next/server';

import { createSupabaseBillingStore } from '@/lib/billing/store';
import { createStripeGateway, getStripe } from '@/lib/billing/stripe';
import { handleStripeWebhook } from '@/lib/billing/webhook';
import { getEnv } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Stripe-webhook. Configureer in Stripe: `<APP_URL>/api/stripe/webhook` met de
 * events uit README §Betalingen. De ruwe body is nodig voor de signatuur.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const stripe = getStripe();

  const result = await handleStripeWebhook({
    rawBody,
    signature: request.headers.get('stripe-signature'),
    secret: getEnv().STRIPE_WEBHOOK_SECRET,
    gateway: stripe ? createStripeGateway(stripe) : null,
    store: createSupabaseBillingStore(createSupabaseAdminClient()),
  });

  if (result.status >= 500) {
    console.error('[stripe-webhook]', result.body.error);
  }

  return NextResponse.json(result.body, { status: result.status });
}
