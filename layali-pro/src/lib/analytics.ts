/**
 * Lightweight analytics events helper.
 *
 * Fires to Google Analytics (gtag), Meta Pixel (fbq) and TikTok Pixel (ttq)
 * when those scripts are loaded (see components/Analytics.tsx). Every call is a
 * safe no-op when a given platform isn't configured, so it can be sprinkled
 * through the app without guards.
 *
 * Configure the real IDs via env vars — see .env.example:
 *   NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_TIKTOK_PIXEL_ID
 */

type Dict = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, data?: Dict) => void };
    dataLayer?: unknown[];
  }
}

function gtagEvent(name: string, params: Dict) {
  window.gtag?.("event", name, params);
}

export function trackAddToCart(item: { id: string; name: string; price: number; quantity: number }) {
  if (typeof window === "undefined") return;
  const value = item.price * item.quantity;
  gtagEvent("add_to_cart", {
    currency: "EUR",
    value,
    items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity }],
  });
  window.fbq?.("track", "AddToCart", { content_ids: [item.id], content_name: item.name, value, currency: "EUR" });
  window.ttq?.track("AddToCart", { content_id: item.id, value, currency: "EUR" });
}

export function trackBeginCheckout(value: number) {
  if (typeof window === "undefined") return;
  gtagEvent("begin_checkout", { currency: "EUR", value });
  window.fbq?.("track", "InitiateCheckout", { value, currency: "EUR" });
  window.ttq?.track("InitiateCheckout", { value, currency: "EUR" });
}

export function trackPurchase(orderNumber: string, value: number) {
  if (typeof window === "undefined") return;
  gtagEvent("purchase", { transaction_id: orderNumber, currency: "EUR", value });
  window.fbq?.("track", "Purchase", { value, currency: "EUR" });
  window.ttq?.track("CompletePayment", { value, currency: "EUR", description: orderNumber });
}
