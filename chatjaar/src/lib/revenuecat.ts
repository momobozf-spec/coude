import "server-only";

/**
 * Server-side check of an in-app purchase made in the mobile app, via the RevenueCat REST API v1.
 * GET /subscribers/{app_user_id} returns non_subscriptions keyed by product id; each purchase has a
 * RevenueCat `id` and a `store_transaction_id`. The app sends the transaction identifier from the SDK,
 * which we match against either one. AI runs per purchase are counted in a subscriber attribute.
 */
const RC_API = "https://api.revenuecat.com/v1";

interface RcTransaction {
  id: string;
  store_transaction_id?: string;
  purchase_date?: string;
  store?: string;
  is_sandbox?: boolean;
}

interface RcSubscriberResponse {
  subscriber?: {
    non_subscriptions?: Record<string, RcTransaction[]>;
    subscriber_attributes?: Record<string, { value?: string }>;
  };
}

export function unlockProductId(): string {
  return process.env.REVENUECAT_PRODUCT_ID || "chatjaar_unlock";
}

function secretKey(): string {
  const k = process.env.REVENUECAT_SECRET_KEY;
  if (!k) throw new Error("Missing environment variable REVENUECAT_SECRET_KEY");
  return k;
}

const SAFE_ID = /^[\w$:.\-@]{1,200}$/;

export function isValidAppUserId(v: unknown): v is string {
  return typeof v === "string" && SAFE_ID.test(v);
}

export function isValidTransactionId(v: unknown): v is string {
  return typeof v === "string" && /^[\w.:\-]{1,200}$/.test(v);
}

async function getSubscriber(appUserId: string): Promise<RcSubscriberResponse | null> {
  const res = await fetch(`${RC_API}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as RcSubscriberResponse;
}

export interface VerifiedUnlock {
  /** Attribute key that counts the AI runs for this purchase. */
  runsKey: string;
  runs: number;
}

/** Pure matcher, exported for tests. */
export function matchUnlock(data: RcSubscriberResponse, productId: string, transactionId: string): VerifiedUnlock | null {
  const txs = data.subscriber?.non_subscriptions?.[productId] ?? [];
  const tx = txs.find((t) => t.id === transactionId || t.store_transaction_id === transactionId);
  if (!tx) return null;
  const runsKey = `chatjaar_ai_runs_${tx.id.replace(/[^A-Za-z0-9_]/g, "_")}`;
  const runs = Number(data.subscriber?.subscriber_attributes?.[runsKey]?.value ?? "0") || 0;
  return { runsKey, runs };
}

/** Returns the purchase if this app user really bought the unlock product with this transaction. */
export async function verifyUnlock(appUserId: string, transactionId: string): Promise<VerifiedUnlock | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await getSubscriber(appUserId);
    const hit = data ? matchUnlock(data, unlockProductId(), transactionId) : null;
    if (hit) return hit;
    // A purchase can take a moment to show up right after checkout.
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function setRuns(appUserId: string, runsKey: string, runs: number): Promise<void> {
  await fetch(`${RC_API}/subscribers/${encodeURIComponent(appUserId)}/attributes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ attributes: { [runsKey]: { value: String(runs), updated_at_ms: Date.now() } } }),
    cache: "no-store",
  });
}
