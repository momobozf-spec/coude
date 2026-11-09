import 'server-only';

import Stripe from 'stripe';

import { getEnv } from '@/lib/env';
import type { StripeGateway } from '@/lib/billing/webhook';

let cached: Stripe | null = null;

/** Stripe-client, of null wanneer Stripe niet geconfigureerd is. */
export function getStripe(): Stripe | null {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!cached) {
    cached = new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: { name: 'RentGuard Brussels' },
      maxNetworkRetries: 2,
    });
  }
  return cached;
}

/** Dunne laag over de Stripe-SDK, zodat de webhooklogica testbaar blijft. */
export function createStripeGateway(stripe: Stripe): StripeGateway {
  return {
    constructEvent: (rawBody, signature, secret) =>
      stripe.webhooks.constructEvent(rawBody, signature, secret),
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    findCheckoutSessionByPaymentIntent: async (paymentIntentId) => {
      const list = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      return list.data[0] ?? null;
    },
  };
}
