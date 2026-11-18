import "server-only";
import Stripe from "stripe";
import Anthropic from "@anthropic-ai/sdk";

export const PRICE_CENTS = 799;
export const CURRENCY = "eur";
export const PRODUCT_TAG = "chatjaar";
/** How many AI generations one payment may trigger (retries included). */
export const MAX_AI_RUNS = 3;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  stripe ??= new Stripe(required("STRIPE_SECRET_KEY"));
  return stripe;
}

let anthropic: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  anthropic ??= new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });
  return anthropic;
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Returns the paid Checkout Session, or null when it does not exist, is unpaid or is not ours. */
export async function getPaidSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    if (session.metadata?.product !== PRODUCT_TAG) return null;
    return session;
  } catch {
    return null;
  }
}
