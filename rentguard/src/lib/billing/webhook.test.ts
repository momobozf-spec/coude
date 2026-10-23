import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  handleStripeWebhook,
  mapSubscriptionStatus,
  type BillingStore,
  type GrantResult,
  type StripeGateway,
} from '@/lib/billing/webhook';
import type { SubscriptionStatus } from '@/lib/supabase/types';

/**
 * Webhooktests met gemockte Stripe-events.
 *
 * De signatuur wordt met de échte Stripe-SDK aangemaakt en gecontroleerd
 * (lokale HMAC, geen netwerk). De databank is een in-memory implementatie van
 * `BillingStore` met dezelfde uniciteitsregels als de migratie.
 */

const SECRET = 'whsec_test_secret_for_unit_tests_only';
const stripe = new Stripe('sk_test_dummy_not_a_real_key');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';

interface EntitlementRow {
  userId: string;
  planKey: string;
  propertyId: string;
  sessionId: string;
  revoked: boolean;
}

class MemoryStore implements BillingStore {
  events = new Map<string, { processed: boolean; note: string | null; error: string | null }>();
  entitlements: EntitlementRow[] = [];
  properties = new Map<string, string>([[PROPERTY, USER]]);
  customers = new Map<string, string>();
  subscriptions = new Map<string, { status: SubscriptionStatus; end: string | null }>();
  failNextGrant = false;

  async recordEvent({ id }: { id: string }) {
    const existing = this.events.get(id);
    if (!existing) {
      this.events.set(id, { processed: false, note: null, error: null });
      return 'NEW' as const;
    }
    return existing.processed ? ('ALREADY_PROCESSED' as const) : ('RETRY' as const);
  }
  async markProcessed(id: string, note?: string | null) {
    this.events.set(id, { processed: true, note: note ?? null, error: null });
  }
  async markFailed(id: string, error: string) {
    const row = this.events.get(id)!;
    row.error = error;
  }
  async getPropertyOwner(propertyId: string) {
    return this.properties.get(propertyId) ?? null;
  }
  async grantStripeEntitlement(input: {
    userId: string;
    planKey: string;
    propertyId: string;
    checkoutSessionId: string;
  }): Promise<GrantResult> {
    if (this.failNextGrant) {
      this.failNextGrant = false;
      throw new Error('connection reset');
    }
    if (this.entitlements.some((e) => e.sessionId === input.checkoutSessionId)) {
      return 'ALREADY_GRANTED';
    }
    if (
      this.entitlements.some(
        (e) =>
          !e.revoked &&
          e.userId === input.userId &&
          e.planKey === input.planKey &&
          e.propertyId === input.propertyId,
      )
    ) {
      return 'DUPLICATE_ACTIVE';
    }
    this.entitlements.push({
      userId: input.userId,
      planKey: input.planKey,
      propertyId: input.propertyId,
      sessionId: input.checkoutSessionId,
      revoked: false,
    });
    return 'GRANTED';
  }
  async revokeByCheckoutSession(sessionId: string) {
    let n = 0;
    for (const e of this.entitlements) {
      if (e.sessionId === sessionId && !e.revoked) {
        e.revoked = true;
        n += 1;
      }
    }
    return n;
  }
  async linkCustomer(userId: string, customerId: string) {
    if (!this.customers.has(customerId)) this.customers.set(customerId, userId);
  }
  async findUserIdByCustomer(customerId: string) {
    return this.customers.get(customerId) ?? null;
  }
  async updateSubscription(input: {
    userId: string;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  }) {
    this.subscriptions.set(input.userId, {
      status: input.status,
      end: input.currentPeriodEnd,
    });
  }
}

function gateway(overrides: Partial<StripeGateway> = {}): StripeGateway {
  return {
    constructEvent: (body, sig, secret) => stripe.webhooks.constructEvent(body, sig, secret),
    retrieveSubscription: vi.fn(),
    findCheckoutSessionByPaymentIntent: vi.fn(),
    ...overrides,
  };
}

let counter = 0;
function event(type: string, object: Record<string, unknown>) {
  counter += 1;
  return {
    id: `evt_test_${counter}`,
    object: 'event',
    type,
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  };
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    status: 'complete',
    client_reference_id: USER,
    customer: 'cus_test_1',
    subscription: null,
    metadata: {
      user_id: USER,
      plan_key: 'deposit_recovery',
      property_id: PROPERTY,
      withdrawal_waiver: 'accepted',
    },
    ...overrides,
  };
}

function signed(payload: unknown, secret = SECRET) {
  const rawBody = JSON.stringify(payload);
  const signature = stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret });
  return { rawBody, signature };
}

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

async function deliver(payload: unknown, gw = gateway(), secret = SECRET) {
  const { rawBody, signature } = signed(payload, secret);
  return handleStripeWebhook({ rawBody, signature, secret: SECRET, gateway: gw, store });
}

describe('signatuurcontrole', () => {
  it('weigert een verzoek zonder Stripe-Signature', async () => {
    const res = await handleStripeWebhook({
      rawBody: JSON.stringify(event('checkout.session.completed', checkoutSession())),
      signature: null,
      secret: SECRET,
      gateway: gateway(),
      store,
    });
    expect(res.status).toBe(400);
    expect(store.entitlements).toHaveLength(0);
    expect(store.events.size).toBe(0);
  });

  it('weigert een signatuur met een ander geheim', async () => {
    const res = await deliver(
      event('checkout.session.completed', checkoutSession()),
      gateway(),
      'whsec_attacker',
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SIGNATURE');
    expect(store.entitlements).toHaveLength(0);
  });

  it('weigert een body die na het ondertekenen gewijzigd is', async () => {
    const original = event('checkout.session.completed', checkoutSession());
    const { signature } = signed(original);
    const tampered = JSON.stringify({
      ...original,
      data: { object: checkoutSession({ metadata: { ...checkoutSession().metadata, user_id: OTHER_USER } }) },
    });
    const res = await handleStripeWebhook({
      rawBody: tampered,
      signature,
      secret: SECRET,
      gateway: gateway(),
      store,
    });
    expect(res.status).toBe(400);
    expect(store.entitlements).toHaveLength(0);
  });

  it('geeft 503 wanneer Stripe niet geconfigureerd is', async () => {
    const res = await handleStripeWebhook({
      rawBody: '{}',
      signature: 't=1,v1=x',
      secret: undefined,
      gateway: null,
      store,
    });
    expect(res.status).toBe(503);
  });
});

describe('checkout.session.completed', () => {
  it('kent het eenmalige pakket toe voor de woning', async () => {
    const res = await deliver(event('checkout.session.completed', checkoutSession()));
    expect(res.status).toBe(200);
    expect(store.entitlements).toEqual([
      {
        userId: USER,
        planKey: 'deposit_recovery',
        propertyId: PROPERTY,
        sessionId: 'cs_test_1',
        revoked: false,
      },
    ]);
    expect(store.customers.get('cus_test_1')).toBe(USER);
  });

  it('is idempotent: hetzelfde event twee keer geeft één toekenning', async () => {
    const payload = event('checkout.session.completed', checkoutSession());
    await deliver(payload);
    const second = await deliver(payload);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(store.entitlements).toHaveLength(1);
  });

  it('is idempotent over completed + async_payment_succeeded voor dezelfde sessie', async () => {
    await deliver(event('checkout.session.completed', checkoutSession()));
    await deliver(event('checkout.session.async_payment_succeeded', checkoutSession()));
    expect(store.entitlements).toHaveLength(1);
  });

  it('kent niets toe zolang de betaling nog loopt (Bancontact/SEPA)', async () => {
    const res = await deliver(
      event('checkout.session.completed', checkoutSession({ payment_status: 'unpaid' })),
    );
    expect(res.status).toBe(200);
    expect(store.entitlements).toHaveLength(0);

    await deliver(event('checkout.session.async_payment_succeeded', checkoutSession()));
    expect(store.entitlements).toHaveLength(1);
  });

  it('kent niets toe bij een mislukte asynchrone betaling', async () => {
    await deliver(
      event('checkout.session.async_payment_failed', checkoutSession({ payment_status: 'unpaid' })),
    );
    expect(store.entitlements).toHaveLength(0);
  });

  it('weigert een woning die niet van de koper is', async () => {
    store.properties.set(PROPERTY, OTHER_USER);
    const res = await deliver(event('checkout.session.completed', checkoutSession()));
    expect(res.status).toBe(200); // permanent: niet opnieuw laten proberen
    expect(store.entitlements).toHaveLength(0);
    expect([...store.events.values()][0].note).toMatch(/PERMANENT/);
  });

  it('weigert een onbekend plan', async () => {
    await deliver(
      event(
        'checkout.session.completed',
        checkoutSession({ metadata: { user_id: USER, plan_key: 'free_checkin', property_id: PROPERTY } }),
      ),
    );
    expect(store.entitlements).toHaveLength(0);
  });

  it('weigert een sessie waarvan client_reference_id niet overeenkomt', async () => {
    await deliver(
      event('checkout.session.completed', checkoutSession({ client_reference_id: OTHER_USER })),
    );
    expect(store.entitlements).toHaveLength(0);
  });

  it('weigert een plan met de verkeerde mode', async () => {
    await deliver(event('checkout.session.completed', checkoutSession({ mode: 'subscription' })));
    expect(store.entitlements).toHaveLength(0);
  });

  it('noteert een dubbele aankoop voor dezelfde woning in plaats van te falen', async () => {
    await deliver(event('checkout.session.completed', checkoutSession()));
    const res = await deliver(
      event('checkout.session.completed', checkoutSession({ id: 'cs_test_2' })),
    );
    expect(res.status).toBe(200);
    expect(res.body.note).toMatch(/dubbele betaling/);
    expect(store.entitlements).toHaveLength(1);
  });

  it('geeft 500 bij een tijdelijke databankfout en verwerkt bij de volgende poging', async () => {
    const payload = event('checkout.session.completed', checkoutSession());
    store.failNextGrant = true;
    const first = await deliver(payload);
    expect(first.status).toBe(500);
    expect(store.entitlements).toHaveLength(0);

    const retry = await deliver(payload);
    expect(retry.status).toBe(200);
    expect(store.entitlements).toHaveLength(1);
  });
});

describe('abonnementen', () => {
  const subscription = {
    id: 'sub_test_1',
    object: 'subscription',
    customer: 'cus_test_9',
    status: 'active',
    metadata: { user_id: USER },
    items: { object: 'list', data: [{ id: 'si_1', current_period_end: 1893456000 }] },
  };

  it('zet de abonnementsstatus na een geslaagde checkout', async () => {
    const gw = gateway({
      retrieveSubscription: vi.fn().mockResolvedValue(subscription),
    });
    await deliver(
      event(
        'checkout.session.completed',
        checkoutSession({
          mode: 'subscription',
          subscription: 'sub_test_1',
          customer: 'cus_test_9',
          metadata: { user_id: USER, plan_key: 'tenant_protect', property_id: '', withdrawal_waiver: 'accepted' },
        }),
      ),
      gw,
    );
    expect(store.subscriptions.get(USER)).toEqual({
      status: 'ACTIVE',
      end: new Date(1893456000 * 1000).toISOString(),
    });
    expect(store.entitlements).toHaveLength(0);
  });

  it('volgt annulering via customer.subscription.deleted', async () => {
    store.customers.set('cus_test_9', USER);
    await deliver(
      event('customer.subscription.deleted', { ...subscription, metadata: {}, status: 'canceled' }),
    );
    expect(store.subscriptions.get(USER)?.status).toBe('CANCELED');
  });

  it('vertaalt Stripe-statussen naar de enum', () => {
    expect(mapSubscriptionStatus('active')).toBe('ACTIVE');
    expect(mapSubscriptionStatus('trialing')).toBe('TRIALING');
    expect(mapSubscriptionStatus('unpaid')).toBe('PAST_DUE');
    expect(mapSubscriptionStatus('incomplete')).toBe('NONE');
    expect(mapSubscriptionStatus('incomplete_expired')).toBe('CANCELED');
  });
});

describe('terugbetaling', () => {
  it('trekt het pakket in bij een volledige terugbetaling', async () => {
    await deliver(event('checkout.session.completed', checkoutSession()));
    const gw = gateway({
      findCheckoutSessionByPaymentIntent: vi.fn().mockResolvedValue({ id: 'cs_test_1' }),
    });
    await deliver(
      event('charge.refunded', { id: 'ch_1', object: 'charge', refunded: true, payment_intent: 'pi_1' }),
      gw,
    );
    expect(store.entitlements[0].revoked).toBe(true);
  });

  it('laat het pakket staan bij een gedeeltelijke terugbetaling', async () => {
    await deliver(event('checkout.session.completed', checkoutSession()));
    await deliver(
      event('charge.refunded', { id: 'ch_2', object: 'charge', refunded: false, payment_intent: 'pi_1' }),
    );
    expect(store.entitlements[0].revoked).toBe(false);
  });
});
