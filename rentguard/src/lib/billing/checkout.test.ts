import { describe, expect, it } from 'vitest';

import { CheckoutInputError, buildCheckoutSessionParams } from '@/lib/billing/checkout';
import { purchasablePlans } from '@/lib/billing/plans';

const BASE = {
  priceId: 'price_test_123',
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'huurder@example.be',
  stripeCustomerId: null,
  propertyId: '33333333-3333-4333-8333-333333333333',
  locale: 'nl' as const,
  appUrl: 'https://app.example.be/',
  withdrawalWaiverAccepted: true,
};

describe('buildCheckoutSessionParams', () => {
  it('maakt een eenmalige betaling met metadata voor de webhook', () => {
    const params = buildCheckoutSessionParams({ ...BASE, plan: 'deposit_recovery' });
    expect(params.mode).toBe('payment');
    expect(params.line_items).toEqual([{ price: 'price_test_123', quantity: 1 }]);
    expect(params.client_reference_id).toBe(BASE.userId);
    expect(params.metadata).toEqual({
      user_id: BASE.userId,
      plan_key: 'deposit_recovery',
      property_id: BASE.propertyId,
      withdrawal_waiver: 'accepted',
    });
    expect(params.success_url).toBe('https://app.example.be/nl/billing?checkout=success');
    expect(params.customer_email).toBe(BASE.email);
    expect(params.locale).toBe('nl');
  });

  it('gebruikt een bestaande Stripe-klant', () => {
    const params = buildCheckoutSessionParams({
      ...BASE,
      plan: 'relocation_pass',
      stripeCustomerId: 'cus_123',
    });
    expect(params.customer).toBe('cus_123');
    expect(params.customer_email).toBeUndefined();
  });

  it('weigert een eenmalig pakket zonder woning', () => {
    expect(() =>
      buildCheckoutSessionParams({ ...BASE, plan: 'deposit_recovery', propertyId: null }),
    ).toThrow(CheckoutInputError);
  });

  it('weigert zonder uitdrukkelijke vraag tot onmiddellijke uitvoering', () => {
    expect(() =>
      buildCheckoutSessionParams({
        ...BASE,
        plan: 'deposit_recovery',
        withdrawalWaiverAccepted: false,
      }),
    ).toThrow(CheckoutInputError);
  });

  it('maakt een abonnement zonder woning', () => {
    const params = buildCheckoutSessionParams({
      ...BASE,
      plan: 'tenant_protect',
      propertyId: null,
    });
    expect(params.mode).toBe('subscription');
    expect(params.subscription_data?.metadata?.plan_key).toBe('tenant_protect');
  });
});

describe('purchasablePlans', () => {
  const stripe = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' };

  it('niets te koop zonder Stripe-configuratie', () => {
    expect(purchasablePlans({ STRIPE_PRICE_DEPOSIT_RECOVERY: 'price_1' })).toEqual([]);
  });

  it('alleen formules met een Price-ID', () => {
    expect(purchasablePlans({ ...stripe, STRIPE_PRICE_DEPOSIT_RECOVERY: 'price_1' })).toEqual([
      'deposit_recovery',
    ]);
  });

  it('abonnement alleen met feature-flag', () => {
    const env = { ...stripe, STRIPE_PRICE_TENANT_PROTECT: 'price_3' };
    expect(purchasablePlans(env)).toEqual([]);
    expect(
      purchasablePlans({ ...env, FEATURE_TENANT_PROTECT_SUBSCRIPTION: true }),
    ).toEqual(['tenant_protect']);
  });
});
