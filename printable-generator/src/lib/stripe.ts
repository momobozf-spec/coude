import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  school_monthly: process.env.STRIPE_SCHOOL_MONTHLY_PRICE_ID!,
  school_yearly: process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID!,
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;

// Reverse-lookup: given a Stripe price ID, determine which plan it belongs to
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

// Backward compat
export const STRIPE_PRO_PRICE_ID =
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID!;
