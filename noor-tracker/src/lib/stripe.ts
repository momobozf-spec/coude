import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export { getStripe as stripe };

export async function createCheckoutSession(
  userId: string,
  email: string,
  customerId?: string | null
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : email,
    mode: "subscription",
    payment_method_types: ["card", "ideal"],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard`,
    metadata: {
      userId,
    },
  });

  return session;
}

export async function createBillingPortalSession(customerId: string) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXTAUTH_URL}/settings`,
  });

  return session;
}
