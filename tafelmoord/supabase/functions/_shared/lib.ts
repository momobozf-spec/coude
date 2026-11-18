// Pure logica voor de shop. Geen Deno- of Node-specifieke API's, zodat dit zowel in
// Supabase Edge Functions (Deno) als in de tests (Node) draait.
// De productcatalogus (catalog.json) wordt gegenereerd door build/site.py.

import catalogJson from "./catalog.json" with { type: "json" };

export interface Product {
  game: string;
  lang: "nl" | "fr" | string;
  category: string;
  brand: string;
  title: string;
  subtitle: string;
  age: string;
  min_players: number;
  max_players: number;
  price_cents: number;
  file: string;
}

export const CATALOG: Record<string, Product> = catalogJson as Record<string, Product>;
export const DOWNLOAD_VALID_DAYS = 183; // ~6 maanden, zoals beloofd op de site

export interface ShopConfig {
  siteUrl: string;                    // bv. https://tafelmoord.be (zonder slash op het einde)
  priceIds?: Record<string, string>;  // Stripe Price ID per product-id (aanbevolen)
  taxRateId?: string;                 // Stripe Tax Rate 21% inclusief (voor btw op de factuur)
}

const TEXT: Record<string, { waiver: string; terms: string; subject: string; email: (title: string, link: string) => string }> = {
  nl: {
    waiver: "Ik vraag uitdrukkelijk om de digitale inhoud meteen te ontvangen en ik erken dat ik daardoor mijn herroepingsrecht verlies.",
    terms: "Ik ga akkoord met de [algemene voorwaarden]",
    subject: "Je spel staat klaar",
    email: (title, link) => `<p>Bedankt voor je bestelling van ${title}.</p>
<p><a href="${link}">Download je spelpakket</a> (de link blijft 6 maanden geldig).</p>
<p>Begin met de gids. Open de karakterboekjes van anderen niet, en de oplossing pas na de stemming.</p>
<p>Veel speelplezier!<br>Marhaba Cooperation BV</p>`,
  },
  fr: {
    waiver: "Je demande expressément à recevoir le contenu numérique immédiatement et je reconnais perdre ainsi mon droit de rétractation.",
    terms: "J'accepte les [conditions générales]",
    subject: "Ton jeu est prêt",
    email: (title, link) => `<p>Merci pour ta commande de ${title}.</p>
<p><a href="${link}">Télécharge ton kit de jeu</a> (le lien reste valable 6 mois).</p>
<p>Commence par le guide. N'ouvre pas les livrets des autres, et la solution seulement après le vote.</p>
<p>Bon jeu !<br>Marhaba Cooperation BV</p>`,
  },
};

function text(lang: string) {
  return TEXT[lang] ?? TEXT.nl;
}

export const WAIVER_TEXT = TEXT.nl.waiver;

/** Zet een genest object om in Stripe's form-encoding (a[b][0][c]=x). */
export function stripeEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object" && v !== null) out.push(...stripeEncode(v as Record<string, unknown>, `${k}[${i}]`));
        else out.push(`${encodeURIComponent(`${k}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else if (typeof value === "object") {
      out.push(...stripeEncode(value as Record<string, unknown>, k));
    } else {
      out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

export class InputError extends Error {}

export function getProduct(id: unknown, catalog: Record<string, Product> = CATALOG): Product | null {
  return typeof id === "string" && Object.hasOwn(catalog, id) ? catalog[id] : null;
}

/** Bouwt de parameters voor POST /v1/checkout/sessions. Weigert onbekende producten en ontbrekende afstand. */
export function buildCheckoutParams(
  cfg: ShopConfig,
  input: { product: unknown; waiver: unknown; nowIso: string },
  catalog: Record<string, Product> = CATALOG,
): string {
  const product = getProduct(input.product, catalog);
  if (!product) throw new InputError("Onbekend spel.");
  const t = text(product.lang);
  if (input.waiver !== true) {
    throw new InputError(product.lang === "fr"
      ? "Coche la case pour recevoir le jeu immédiatement."
      : "Je moet aanvinken dat je het spel meteen wil ontvangen.");
  }
  if (!cfg.siteUrl || !/^https:\/\//.test(cfg.siteUrl)) {
    throw new Error("SITE_URL ontbreekt of is geen https-adres");
  }
  const productId = input.product as string;
  const priceId = cfg.priceIds?.[productId];
  const lineItem: Record<string, unknown> = priceId
    ? { price: priceId, quantity: 1 }
    : {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: product.price_cents,
        product_data: { name: `${product.title} (${product.brand}, ${product.lang.toUpperCase()})` },
      },
    };
  if (cfg.taxRateId) lineItem.tax_rates = [cfg.taxRateId];

  const base = `${cfg.siteUrl}/${product.lang}`;
  const params = {
    mode: "payment",
    locale: product.lang === "fr" ? "fr" : "nl",
    line_items: [lineItem],
    success_url: `${base}/bedankt.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/${product.game}.html`,
    invoice_creation: { enabled: "true" },
    billing_address_collection: "auto",
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: { message: `${t.terms}(${base}/voorwaarden.html). ${t.waiver}` },
    },
    metadata: {
      product: productId,
      withdrawal_waiver: "true",
      withdrawal_waiver_at: input.nowIso,
    },
    payment_intent_data: { metadata: { product: productId } },
  };
  // De placeholder {CHECKOUT_SESSION_ID} moet letterlijk blijven staan voor Stripe.
  return stripeEncode(params).join("&").replace(/%7BCHECKOUT_SESSION_ID%7D/g, "{CHECKOUT_SESSION_ID}");
}

/** Leest STRIPE_PRICES (JSON: {"oudejaar-nl":"price_...", ...}). Ongeldige of onbekende sleutels geven een fout. */
export function parsePriceIds(raw: string | undefined, catalog: Record<string, Product> = CATALOG): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("STRIPE_PRICES is geen geldige JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("STRIPE_PRICES moet een object zijn");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!getProduct(k, catalog)) throw new Error(`STRIPE_PRICES: onbekend product '${k}'`);
    if (typeof v !== "string" || !v.startsWith("price_")) throw new Error(`STRIPE_PRICES: ongeldige prijs voor '${k}'`);
    out[k] = v;
  }
  return out;
}

export interface StripeSessionLike {
  id: string;
  payment_status: string;
  status?: string;
  created: number; // unix seconden
  metadata?: Record<string, string> | null;
}

export type DownloadDecision =
  | { ok: true; product: Product }
  | { ok: false; status: number; reason: string };

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id);
}

/** Mag deze betaalde sessie een pakket downloaden, en welk? */
export function downloadDecision(
  s: StripeSessionLike,
  nowMs: number,
  catalog: Record<string, Product> = CATALOG,
): DownloadDecision {
  const product = getProduct(s.metadata?.product, catalog);
  if (!product) return { ok: false, status: 404, reason: "Onbekende bestelling / Commande inconnue" };
  const fr = product.lang === "fr";
  if (s.payment_status !== "paid") {
    return { ok: false, status: 402, reason: fr ? "Paiement pas encore reçu" : "Betaling nog niet ontvangen" };
  }
  const ageDays = (nowMs / 1000 - s.created) / 86400;
  if (ageDays > DOWNLOAD_VALID_DAYS) {
    return {
      ok: false, status: 410,
      reason: fr ? "Lien expiré. Écris-nous, nous te renvoyons le jeu." : "Downloadlink verlopen. Mail ons, dan sturen we het spel opnieuw.",
    };
  }
  return { ok: true, product };
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/** Controleert de Stripe-Signature header (schema v1) met tolerantie in seconden. */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSec: number,
  toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=", 2) as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return sigs.some((s) => timingSafeEqual(s, expected));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function downloadEmail(siteUrl: string, sessionId: string, product: Product): { subject: string; html: string } {
  const t = text(product.lang);
  const link = `${siteUrl}/${product.lang}/bedankt.html?session_id=${encodeURIComponent(sessionId)}`;
  return { subject: `${t.subject} – ${product.title}`, html: t.email(escapeHtml(product.title), link) };
}
