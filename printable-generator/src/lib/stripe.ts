import Stripe from "stripe";

// Lazy init so a missing/dummy STRIPE_SECRET_KEY doesn't crash module load in dev.
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || "sk_test_dummy_replace_for_real_use",
      { apiVersion: "2026-03-25.dahlia" }
    );
  }
  return _stripe;
}
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});

export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  school_monthly: process.env.STRIPE_SCHOOL_MONTHLY_PRICE_ID!,
  school_yearly: process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID!,
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;

export function planFromPriceId(priceId: string): "pro" | "school" | null {
  const proIds = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ];
  const schoolIds = [
    process.env.STRIPE_SCHOOL_MONTHLY_PRICE_ID,
    process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID,
  ];

  if (proIds.includes(priceId)) return "pro";
  if (schoolIds.includes(priceId)) return "school";
  return null;
}

export const STRIPE_PRO_PRICE_ID =
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID!;
