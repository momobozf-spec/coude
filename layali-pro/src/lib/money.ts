/**
 * Geld rekenen zonder afrondingsfouten.
 *
 * In de database staan bedragen als Decimal(10,2); de app leest ze als een
 * getal in euro (zie prisma.ts). Wie met die getallen rekent (0.1 + 0.2 …),
 * krijgt drijvende-kommafouten. Alle servercode die een bedrag berekent dat
 * aangerekend wordt, rekent daarom in hele centen en zet pas aan het einde om.
 */

/** Euro → hele centen. 19.99 → 1999. Werpt bij een ongeldig bedrag. */
export function toCents(euro: number): number {
  if (!Number.isFinite(euro)) throw new Error(`Ongeldig bedrag: ${euro}`);
  return Math.round(euro * 100);
}

/** Hele centen → euro. 1999 → 19.99. */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error(`Centen moeten een geheel getal zijn: ${cents}`);
  return cents / 100;
}

/** Verzendkosten in centen. */
export const SHIPPING = {
  /** Standaard gratis vanaf dit subtotaal. */
  freeFromCents: 7500,
  standardCents: 595,
  expressCents: 995,
} as const;

export type ShippingMethod = "standard" | "express";

export function shippingCents(subtotalCents: number, method: ShippingMethod): number {
  if (method === "express") return SHIPPING.expressCents;
  return subtotalCents >= SHIPPING.freeFromCents ? 0 : SHIPPING.standardCents;
}

export interface CouponTerms {
  discountType: string;
  /** Percentage (0–100) of een vast bedrag in euro. */
  discountValue: number;
}

/**
 * Korting in centen op een subtotaal. Nooit negatief en nooit meer dan het
 * subtotaal: een kortingscode kan de verzendkosten niet wegwerken en de order
 * nooit onder nul brengen.
 */
export function discountCents(subtotalCents: number, coupon: CouponTerms): number {
  let cents: number;
  if (coupon.discountType === "PERCENTAGE") {
    const pct = Math.min(100, Math.max(0, coupon.discountValue));
    cents = Math.round((subtotalCents * pct) / 100);
  } else {
    cents = toCents(Math.max(0, coupon.discountValue));
  }
  return Math.min(cents, subtotalCents);
}
