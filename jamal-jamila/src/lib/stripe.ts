import Stripe from "stripe";

// Lazy init via Proxy so a missing/dummy STRIPE_SECRET_KEY doesn't crash module load in dev.
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || "sk_test_dummy_replace_for_real_use",
      { apiVersion: "2025-03-31.basil", typescript: true }
    );
  }
  return _stripe;
}
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});
