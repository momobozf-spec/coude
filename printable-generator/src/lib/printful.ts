const PRINTFUL_API = "https://api.printful.com";
const API_KEY = process.env.PRINTFUL_API_KEY || "";
const STORE_ID = process.env.PRINTFUL_STORE_ID || "";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...(STORE_ID ? { "X-PF-Store-Id": STORE_ID } : {}),
  };
}

export function isPrintfulConfigured(): boolean {
  return !!(API_KEY && !API_KEY.startsWith("your_"));
}

export const BOOK_VARIANTS = {
  softcover_20: { pages: 20, priceEur: 19.99, priceUsd: 21.99, cost: 8.5, size: "8.5x8.5 inch", label: "Softcover 20 pages" },
  softcover_30: { pages: 30, priceEur: 24.99, priceUsd: 26.99, cost: 11.0, size: "8.5x8.5 inch", label: "Softcover 30 pages" },
  hardcover_20: { pages: 20, priceEur: 29.99, priceUsd: 32.99, cost: 14.0, size: "8.5x8.5 inch", label: "Hardcover 20 pages" },
} as const;

export type BookVariant = keyof typeof BOOK_VARIANTS;

export async function getShippingRates(address: { country: string; zip: string; city: string }, variant: BookVariant) {
  if (!isPrintfulConfigured()) {
    return [
      { id: "standard", name: "Standard Shipping", rate: 4.99, currency: "EUR", minDays: 7, maxDays: 10 },
      { id: "express", name: "Express Shipping", rate: 9.99, currency: "EUR", minDays: 3, maxDays: 5 },
    ];
  }

  const res = await fetch(`${PRINTFUL_API}/shipping/rates`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      recipient: { country_code: address.country, zip: address.zip, city: address.city },
      items: [{ variant_id: variant, quantity: 1 }],
    }),
  });
  const data = await res.json();
  return (data.result || []).map((r: Record<string, unknown>) => ({
    id: r.id, name: r.name, rate: r.rate, currency: r.currency,
    minDays: r.minDeliveryDays, maxDays: r.maxDeliveryDays,
  }));
}

export async function createPrintfulOrder(order: {
  pdfUrl: string;
  coverImageUrl: string;
  recipient: { name: string; address1: string; address2?: string; city: string; state?: string; zip: string; country: string; phone?: string; email: string };
  variant: BookVariant;
  quantity: number;
  externalId: string;
}) {
  if (!isPrintfulConfigured()) {
    console.log("[Printful Mock] Order created:", order.externalId);
    return { printfulOrderId: `mock_${Date.now()}`, status: "draft" };
  }

  const res = await fetch(`${PRINTFUL_API}/orders`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      external_id: order.externalId,
      recipient: order.recipient,
      items: [{
        variant_id: order.variant,
        quantity: order.quantity,
        files: [
          { type: "default", url: order.pdfUrl },
          { type: "preview", url: order.coverImageUrl },
        ],
      }],
    }),
  });
  const data = await res.json();
  return { printfulOrderId: String(data.result?.id || ""), status: data.result?.status || "error" };
}

export async function confirmPrintfulOrder(printfulOrderId: string) {
  if (!isPrintfulConfigured()) return { mock: true };
  const res = await fetch(`${PRINTFUL_API}/orders/${printfulOrderId}/confirm`, { method: "POST", headers: headers() });
  return res.json();
}

export async function getOrderStatus(printfulOrderId: string) {
  if (!isPrintfulConfigured()) {
    return { status: "fulfilled", trackingUrl: null, trackingNumber: null };
  }
  const res = await fetch(`${PRINTFUL_API}/orders/${printfulOrderId}`, { headers: headers() });
  const data = await res.json();
  return {
    status: data.result?.status,
    trackingUrl: data.result?.shipments?.[0]?.tracking_url || null,
    trackingNumber: data.result?.shipments?.[0]?.tracking_number || null,
  };
}

export function parsePrintfulWebhook(payload: Record<string, unknown>) {
  const type = payload.type as string;
  const data = payload.data as Record<string, unknown>;
  const order = data?.order as Record<string, unknown>;
  const shipment = data?.shipment as Record<string, unknown>;

  if (type === "package_shipped") {
    return { event: "shipped" as const, printfulOrderId: String(order?.id), externalId: order?.external_id as string, trackingUrl: shipment?.tracking_url as string, trackingNumber: shipment?.tracking_number as string };
  }
  if (type === "order_failed") {
    return { event: "failed" as const, printfulOrderId: String(order?.id), externalId: order?.external_id as string };
  }
  return { event: "unknown" as const, type };
}
