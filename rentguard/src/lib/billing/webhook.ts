import type Stripe from 'stripe';

import { PAID_PLANS, isPaidPlanKey } from '@/lib/billing/plans';
import type { SubscriptionStatus } from '@/lib/supabase/types';

/**
 * Stripe-webhook: de enige plek waar betaalde toegangsrechten ontstaan.
 *
 * Volgorde per verzoek:
 *
 *  1. **Signatuur.** Zonder geldige `Stripe-Signature` (HMAC over de ruwe body,
 *     met tijdstolerantie tegen replay) wordt er niets gelezen of geschreven.
 *  2. **Idempotentie.** Elk event-ID komt één keer in `stripe_events`. Een
 *     event dat al verwerkt is, wordt bevestigd zonder iets te doen. Een event
 *     waarvan de verwerking eerder mislukte, wordt opnieuw geprobeerd.
 *  3. **Status.** Toegang volgt pas bij `payment_status = paid` (of
 *     `no_payment_required`). Een Bancontact- of SEPA-betaling die nog loopt,
 *     wacht op `checkout.session.async_payment_succeeded`.
 *  4. **Metadata.** Plan, gebruiker en woning komen uit de sessie, maar de
 *     woning moet in de databank ook echt van die gebruiker zijn.
 *
 * Fouten die een nieuwe poging kunnen oplossen (databank onbereikbaar) geven
 * 500, zodat Stripe opnieuw probeert. Fouten die dat niet kunnen (ongeldige
 * metadata) worden genoteerd en met 200 bevestigd, anders blijft Stripe
 * dagenlang hetzelfde foute event sturen.
 */

export interface StripeGateway {
  constructEvent(rawBody: string, signature: string, secret: string): Stripe.Event;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  findCheckoutSessionByPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.Checkout.Session | null>;
}

export type RecordEventResult = 'NEW' | 'ALREADY_PROCESSED' | 'RETRY';

export type GrantResult = 'GRANTED' | 'ALREADY_GRANTED' | 'DUPLICATE_ACTIVE';

export interface BillingStore {
  recordEvent(event: { id: string; type: string; payload: unknown }): Promise<RecordEventResult>;
  markProcessed(eventId: string, note?: string | null): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
  getPropertyOwner(propertyId: string): Promise<string | null>;
  grantStripeEntitlement(input: {
    userId: string;
    planKey: string;
    propertyId: string;
    checkoutSessionId: string;
  }): Promise<GrantResult>;
  revokeByCheckoutSession(checkoutSessionId: string): Promise<number>;
  linkCustomer(userId: string, customerId: string): Promise<void>;
  findUserIdByCustomer(customerId: string): Promise<string | null>;
  updateSubscription(input: {
    userId: string;
    customerId: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  }): Promise<void>;
}

/** Een fout die een nieuwe poging niet oplost. */
export class PermanentWebhookError extends Error {}

export interface WebhookResponse {
  status: number;
  body: { received: boolean; duplicate?: boolean; error?: string; note?: string };
}

type Outcome = { note: string | null };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export function mapSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      // incomplete, paused, onbekend: geen toegang.
      return 'NONE';
  }
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  // Sinds API-versie 2025-03-31 staat de periode op de items.
  const ends = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  store: BillingStore,
): Promise<Outcome> {
  const customerId = idOf(subscription.customer);
  let userId: string | null = subscription.metadata?.user_id || null;
  if (!userId && customerId) userId = await store.findUserIdByCustomer(customerId);
  if (!userId) {
    throw new PermanentWebhookError(
      `Geen gebruiker gevonden voor abonnement ${subscription.id}.`,
    );
  }

  await store.updateSubscription({
    userId,
    customerId,
    status: mapSubscriptionStatus(subscription.status),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
  return { note: null };
}

async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
  deps: { store: BillingStore; gateway: StripeGateway },
): Promise<Outcome> {
  const { store, gateway } = deps;

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    // Asynchrone betaalmethode: wachten op async_payment_succeeded.
    return { note: `payment_status=${session.payment_status}; nog geen toegang` };
  }

  const metadata = session.metadata ?? {};
  const userId = metadata.user_id;
  const planKey = metadata.plan_key;

  if (!userId || !isPaidPlanKey(planKey)) {
    throw new PermanentWebhookError('Sessie zonder geldige user_id of plan_key.');
  }
  if (session.client_reference_id && session.client_reference_id !== userId) {
    throw new PermanentWebhookError('client_reference_id en metadata.user_id verschillen.');
  }

  const plan = PAID_PLANS[planKey];
  const expectedMode = plan.kind === 'SUBSCRIPTION' ? 'subscription' : 'payment';
  if (session.mode !== expectedMode) {
    throw new PermanentWebhookError(
      `Plan ${planKey} verwacht mode=${expectedMode}, kreeg ${session.mode}.`,
    );
  }

  const customerId = idOf(session.customer);
  if (customerId) await store.linkCustomer(userId, customerId);

  if (plan.kind === 'SUBSCRIPTION') {
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) {
      throw new PermanentWebhookError('Abonnementssessie zonder subscription.');
    }
    const subscription = await gateway.retrieveSubscription(subscriptionId);
    if (!subscription.metadata?.user_id) {
      subscription.metadata = { ...subscription.metadata, user_id: userId };
    }
    return syncSubscription(subscription, store);
  }

  const propertyId = metadata.property_id;
  if (!propertyId) {
    throw new PermanentWebhookError('Eenmalig pakket zonder property_id.');
  }

  const owner = await store.getPropertyOwner(propertyId);
  if (owner !== userId) {
    throw new PermanentWebhookError(
      'Woning bestaat niet (meer) of is niet van deze gebruiker; manueel terugbetalen.',
    );
  }

  const result = await store.grantStripeEntitlement({
    userId,
    planKey,
    propertyId,
    checkoutSessionId: session.id,
  });

  if (result === 'DUPLICATE_ACTIVE') {
    // De gebruiker had dit pakket al voor deze woning: dubbel betaald.
    return {
      note: 'Pakket was al actief voor deze woning — dubbele betaling, manueel terugbetalen.',
    };
  }
  return { note: result === 'ALREADY_GRANTED' ? 'al toegekend' : null };
}

async function handleRefund(
  charge: Stripe.Charge,
  deps: { store: BillingStore; gateway: StripeGateway },
): Promise<Outcome> {
  // Alleen een volledige terugbetaling trekt het pakket in.
  if (!charge.refunded) return { note: 'gedeeltelijke terugbetaling; toegang blijft' };

  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return { note: 'geen payment_intent' };

  const session = await deps.gateway.findCheckoutSessionByPaymentIntent(paymentIntentId);
  if (!session) return { note: 'geen Checkout Session voor deze betaling' };

  const revoked = await deps.store.revokeByCheckoutSession(session.id);
  return { note: `ingetrokken: ${revoked}` };
}

export async function processStripeEvent(
  event: Stripe.Event,
  deps: { store: BillingStore; gateway: StripeGateway },
): Promise<Outcome> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return fulfilCheckoutSession(event.data.object, deps);

    case 'checkout.session.async_payment_failed':
      return { note: 'asynchrone betaling mislukt; geen toegang' };

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(event.data.object, deps.store);

    case 'charge.refunded':
      return handleRefund(event.data.object, deps);

    default:
      return { note: 'genegeerd type' };
  }
}

export async function handleStripeWebhook(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
  gateway: StripeGateway | null;
  store: BillingStore;
}): Promise<WebhookResponse> {
  const { rawBody, signature, secret, gateway, store } = input;

  if (!gateway || !secret) {
    return { status: 503, body: { received: false, error: 'STRIPE_NOT_CONFIGURED' } };
  }
  if (!signature) {
    return { status: 400, body: { received: false, error: 'MISSING_SIGNATURE' } };
  }

  let event: Stripe.Event;
  try {
    event = gateway.constructEvent(rawBody, signature, secret);
  } catch {
    return { status: 400, body: { received: false, error: 'INVALID_SIGNATURE' } };
  }

  let recorded: RecordEventResult;
  try {
    recorded = await store.recordEvent({
      id: event.id,
      type: event.type,
      payload: event,
    });
  } catch {
    return { status: 500, body: { received: false, error: 'STORE_UNAVAILABLE' } };
  }

  if (recorded === 'ALREADY_PROCESSED') {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    const outcome = await processStripeEvent(event, { store, gateway });
    await store.markProcessed(event.id, outcome.note);
    return {
      status: 200,
      body: { received: true, ...(outcome.note ? { note: outcome.note } : {}) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PermanentWebhookError) {
      try {
        await store.markProcessed(event.id, `PERMANENT: ${message}`);
      } catch {
        return { status: 500, body: { received: false, error: 'STORE_UNAVAILABLE' } };
      }
      return { status: 200, body: { received: true, note: message } };
    }
    await store.markFailed(event.id, message).catch(() => undefined);
    return { status: 500, body: { received: false, error: 'PROCESSING_FAILED' } };
  }
}
