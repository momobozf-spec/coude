'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveLocale } from '@/i18n/config';
import {
  CheckoutInputError,
  buildCheckoutSessionParams,
} from '@/lib/billing/checkout';
import {
  PAID_PLANS,
  isPaidPlanKey,
  purchasablePlans,
  stripePriceFor,
} from '@/lib/billing/plans';
import { getStripe } from '@/lib/billing/stripe';
import { getEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CheckoutErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_AVAILABLE'
  | 'WAIVER_REQUIRED'
  | 'NOT_FOUND'
  | 'ALREADY_ACTIVE'
  | 'STRIPE_ERROR';

const schema = z.object({
  plan: z.string().refine(isPaidPlanKey),
  propertyId: z.string().uuid().optional(),
  waiver: z.literal('on').optional(),
});

/**
 * Start een Stripe Checkout. De toegang zelf wordt **niet** hier toegekend,
 * maar pas in de webhook na bevestigde betaling.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const fail = (code: CheckoutErrorCode): never =>
    redirect(`/${locale}/billing?error=${code}`);

  const parsed = schema.safeParse({
    plan: formData.get('plan')?.toString(),
    propertyId: formData.get('propertyId')?.toString() || undefined,
    waiver: formData.get('waiver')?.toString() || undefined,
  });
  if (!parsed.success || !isPaidPlanKey(parsed.data.plan)) return fail('INVALID_INPUT');

  const plan = parsed.data.plan;
  const env = getEnv();
  const stripe = getStripe();
  const priceId = stripePriceFor(plan, env);
  if (!stripe || !priceId || !purchasablePlans(env).includes(plan)) {
    return fail('NOT_AVAILABLE');
  }
  if (parsed.data.waiver !== 'on') return fail('WAIVER_REQUIRED');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, subscription_status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return fail('NOT_FOUND');

  let propertyId: string | null = null;
  if (PAID_PLANS[plan].perProperty) {
    if (!parsed.data.propertyId) return fail('INVALID_INPUT');
    // RLS: alleen eigen woningen zijn zichtbaar.
    const { data: property } = await supabase
      .from('properties')
      .select('id')
      .eq('id', parsed.data.propertyId)
      .maybeSingle();
    if (!property) return fail('NOT_FOUND');
    propertyId = property.id;

    const { data: active } = await supabase
      .from('entitlements')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_key', plan)
      .eq('property_id', propertyId)
      .is('revoked_at', null)
      .limit(1);
    if ((active?.length ?? 0) > 0) return fail('ALREADY_ACTIVE');
  } else if (
    profile.subscription_status === 'ACTIVE' ||
    profile.subscription_status === 'TRIALING'
  ) {
    return fail('ALREADY_ACTIVE');
  }

  let url: string | null = null;
  try {
    const params = buildCheckoutSessionParams({
      plan,
      priceId,
      userId: user.id,
      email: profile.email,
      stripeCustomerId: profile.stripe_customer_id,
      propertyId,
      locale,
      appUrl: env.APP_URL,
      withdrawalWaiverAccepted: true,
    });
    const session = await stripe.checkout.sessions.create(params);
    url = session.url;
  } catch (error) {
    if (error instanceof CheckoutInputError) return fail('INVALID_INPUT');
    console.error('[checkout]', error instanceof Error ? error.message : error);
    return fail('STRIPE_ERROR');
  }

  if (!url) return fail('STRIPE_ERROR');
  redirect(url);
}
