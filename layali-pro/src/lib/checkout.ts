import { z } from "zod";
import { discountCents, shippingCents, toCents, type CouponTerms, type ShippingMethod } from "@/lib/money";

/**
 * Invoer en prijsberekening van de checkout — zonder database, zodat dit
 * volledig te testen is. De route haalt producten en kortingscode op en geeft
 * ze hier door; wat de klant zelf meestuurt aan prijzen wordt nooit gebruikt.
 */

const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 20;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const checkoutLineSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  size: optionalText(60),
  color: optionalText(60),
  giftWrap: z.boolean().optional().default(false),
});

export const shippingAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optionalText(40),
  street: z.string().trim().min(1).max(120),
  houseNumber: z.string().trim().min(1).max(20),
  postalCode: z.string().trim().min(4).max(10).regex(/^[0-9A-Za-z ]+$/),
  city: z.string().trim().min(1).max(80),
  country: z.enum(["BE", "NL"]),
});

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutLineSchema).min(1).max(MAX_LINES),
  shippingAddress: shippingAddressSchema,
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
  couponCode: optionalText(40),
  locale: z.enum(["nl", "fr"]).default("nl"),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** Een regel in de winkelmand (na validatie). */
export interface CheckoutLine {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
  giftWrap?: boolean;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: "BE" | "NL";
}

export interface PricedProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
}

export interface CouponRecord extends CouponTerms {
  code: string;
  active: boolean;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date | null;
  expiresAt: Date | null;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Totale gevraagde hoeveelheid per product (dezelfde vaas in twee kleuren telt samen). */
export function quantitiesPerProduct(lines: ReadonlyArray<{ productId: string; quantity: number }>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  return totals;
}

/** Waarom een kortingscode (nu) niet geldt, of null als ze geldt. */
export function couponProblem(coupon: CouponRecord, subtotalCents: number, now: Date): string | null {
  if (!coupon.active) return "Deze kortingscode is niet meer actief";
  if (coupon.validFrom && coupon.validFrom > now) return "Deze kortingscode is nog niet geldig";
  if (coupon.expiresAt && coupon.expiresAt < now) return "Deze kortingscode is verlopen";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return "Deze kortingscode is al het maximale aantal keren gebruikt";
  }
  if (coupon.minOrder !== null && subtotalCents < toCents(coupon.minOrder)) {
    return "Het minimumbedrag voor deze kortingscode is niet bereikt";
  }
  return null;
}

export interface PricedLine extends CheckoutLine {
  productName: string;
  unitPriceCents: number;
}

export interface CheckoutQuote {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
}

/**
 * Berekent de te betalen bedragen. Werpt een CheckoutError als een product
 * niet (meer) te koop is of er te weinig voorraad is. De voorraad wordt hier
 * alleen gecontroleerd; het echte reserveren gebeurt atomair in de database.
 *
 * Een ongeldige kortingscode laat de bestelling niet mislukken: ze wordt
 * genegeerd, net zoals de winkelmand-UI ze niet zou toepassen.
 */
export function quoteCheckout(
  lines: CheckoutLine[],
  products: Map<string, PricedProduct>,
  method: ShippingMethod,
  coupon: CouponRecord | null,
  now = new Date(),
): CheckoutQuote {
  for (const [productId, qty] of quantitiesPerProduct(lines)) {
    const product = products.get(productId);
    if (!product || product.status !== "ACTIVE") throw new CheckoutError("Een product in je winkelmandje is niet meer beschikbaar");
    if (product.stock < qty) throw new CheckoutError(`Onvoldoende voorraad voor ${product.name}`, 409);
  }

  const priced: PricedLine[] = lines.map((line) => {
    const product = products.get(line.productId)!;
    // Cadeauverpakking is gratis; ze staat bij de regel zodat ze op de order zichtbaar is.
    const productName = line.giftWrap ? `${product.name} (cadeauverpakking)` : product.name;
    return { ...line, productName, unitPriceCents: toCents(product.price) };
  });

  const subtotal = priced.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const shipping = shippingCents(subtotal, method);

  let discount = 0;
  let couponCode: string | null = null;
  if (coupon && couponProblem(coupon, subtotal, now) === null) {
    discount = discountCents(subtotal, coupon);
    couponCode = coupon.code;
  }

  return {
    lines: priced,
    subtotalCents: subtotal,
    shippingCents: shipping,
    discountCents: discount,
    totalCents: subtotal + shipping - discount,
    couponCode,
  };
}
