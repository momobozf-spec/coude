import { z } from 'zod';
import { VAT_CODES } from '@superette/vat';

export const vatCodeSchema = z.enum(VAT_CODES);

/**
 * EAN-13 of EAN-8 barcode. We valideren de checksum server-side (zie
 * `CatalogService.findByBarcode`) — een typefout in een handmatig ingevoerde
 * code mag geen willekeurig ander product in de mand leggen.
 */
export const barcodeSchema = z
  .string()
  .regex(/^\d{8}$|^\d{13}$/, 'Barcode moet 8 of 13 cijfers bevatten');

export const scanItemSchema = z.object({
  basketId: z.string().min(1),
  barcode: barcodeSchema,
  /** Standaard 1. De app laat de klant het aantal ophogen na de scan. */
  quantity: z.number().int().positive().max(99).default(1),
});
export type ScanItemInput = z.infer<typeof scanItemSchema>;

export const basketItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  barcode: z.string(),
  nameNl: z.string(),
  nameFr: z.string(),
  imageUrl: z.string().nullable(),
  quantity: z.number().int().positive(),
  /**
   * Prijs zoals gescand, in centen, inclusief BTW. Bewust een *snapshot*:
   * verandert de prijs terwijl de klant in de winkel staat, dan betaalt hij
   * wat op het schap stond. Dat is niet alleen netjes, het is wettelijk.
   */
  unitPriceInclCents: z.number().int().nonnegative(),
  vat: vatCodeSchema,
});
export type BasketItem = z.infer<typeof basketItemSchema>;

export const vatBucketSchema = z.object({
  code: vatCodeSchema,
  rate: z.number(),
  baseExclCents: z.number().int(),
  vatCents: z.number().int(),
  totalInclCents: z.number().int(),
});

export const basketSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  status: z.enum(['OPEN', 'PAID', 'ABANDONED']),
  items: z.array(basketItemSchema),
  totalInclCents: z.number().int().nonnegative(),
  totalExclCents: z.number().int().nonnegative(),
  totalVatCents: z.number().int().nonnegative(),
  vatBuckets: z.array(vatBucketSchema),
});
export type Basket = z.infer<typeof basketSchema>;

/** De betaalmethoden die op de Belgische markt echt gebruikt worden. */
export const paymentMethodSchema = z.enum([
  'BANCONTACT',
  'PAYCONIQ',
  'APPLE_PAY',
  'GOOGLE_PAY',
  'CARD',
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const checkoutSchema = z.object({
  basketId: z.string().min(1),
  method: paymentMethodSchema,
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  /** Waar de app de klant naartoe stuurt om te betalen (Mollie hosted page). */
  redirectUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
