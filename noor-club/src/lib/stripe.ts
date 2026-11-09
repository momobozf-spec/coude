import Stripe from "stripe";

let client: Stripe | null = null;

function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY ontbreekt in de omgeving.");
  }

  client = new Stripe(key, { typescript: true });
  return client;
}

/**
 * Lazily-constructed Stripe client.
 *
 * `next build` imports every module in the graph, including the billing action
 * and the webhook route. Constructing Stripe at module scope would therefore
 * make the build depend on a secret that only exists at runtime. The proxy
 * keeps the ergonomic `stripe.customers.create(...)` call shape while deferring
 * construction (and the missing-key error) to the first real use.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const instance = getStripe();
    const value = Reflect.get(instance, property, instance) as unknown;
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function requireStripeEnv() {
  const missing = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ANNUAL",
    "STRIPE_PRICE_TRIPWIRE",
    "NEXT_PUBLIC_APP_URL",
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Stripe niet geconfigureerd, ontbreekt: ${missing.join(", ")}`);
  }
}
