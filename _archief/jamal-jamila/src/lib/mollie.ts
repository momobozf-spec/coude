/**
 * Minimal Mollie REST client (no SDK dependency — uses fetch).
 *
 * Mollie powers Bancontact, iDEAL, credit card, PayPal and bank transfer, which
 * matters for Belgium/Netherlands. The API key is read from the environment and
 * never hardcoded. When MOLLIE_API_KEY is absent the helpers throw a clear error
 * so misconfiguration is obvious instead of silently failing.
 *
 * Docs: https://docs.mollie.com/reference/v2/payments-api/create-payment
 */

const MOLLIE_API = "https://api.mollie.com/v2";

export type MollieAmount = { currency: string; value: string };

export interface MolliePayment {
  id: string;
  status:
    | "open"
    | "pending"
    | "authorized"
    | "paid"
    | "canceled"
    | "expired"
    | "failed";
  amount: MollieAmount;
  description: string;
  metadata: Record<string, unknown> | null;
  method: string | null;
  _links: { checkout?: { href: string }; self?: { href: string } };
}

function apiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) {
    throw new Error("MOLLIE_API_KEY is not configured");
  }
  return key;
}

/** Whether Mollie is configured (used to choose a payment provider at runtime). */
export function isMollieConfigured(): boolean {
  return Boolean(process.env.MOLLIE_API_KEY);
}

/** Format a number as a Mollie amount string, e.g. 12.5 → "12.50". */
export function toMollieAmount(value: number, currency = "EUR"): MollieAmount {
  return { currency, value: value.toFixed(2) };
}

async function mollieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MOLLIE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    // Payments must never be cached.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mollie API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export interface CreatePaymentInput {
  amount: number;
  description: string;
  redirectUrl: string;
  /** Omit on localhost (Mollie cannot reach it); set in production. */
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
  locale?: string;
}

export async function createMolliePayment(input: CreatePaymentInput): Promise<MolliePayment> {
  const body: Record<string, unknown> = {
    amount: toMollieAmount(input.amount),
    description: input.description,
    redirectUrl: input.redirectUrl,
    metadata: input.metadata ?? {},
  };
  // Only attach a webhook when it is publicly reachable (https, not localhost).
  if (input.webhookUrl && /^https:\/\//.test(input.webhookUrl) && !/localhost|127\.0\.0\.1/.test(input.webhookUrl)) {
    body.webhookUrl = input.webhookUrl;
  }
  if (input.locale) {
    // Mollie expects e.g. nl_BE / fr_BE
    body.locale = input.locale === "fr" ? "fr_BE" : "nl_BE";
  }
  return mollieFetch<MolliePayment>("/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMolliePayment(id: string): Promise<MolliePayment> {
  return mollieFetch<MolliePayment>(`/payments/${encodeURIComponent(id)}`);
}
