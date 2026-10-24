import { z } from 'zod';
import { paymentMethodSchema, vatBucketSchema } from './basket';

/**
 * Een digitale kasbon zoals de klant hem in "Mijn aankopen" ziet, en zoals hij
 * als BTW-bon geldig is.
 *
 * `invoiceNumber` is doorlopend en gapenloos per boekjaar — een vereiste van de
 * Belgische BTW-wetgeving (KB nr. 1, art. 5). De nummering wordt daarom in een
 * database-transactie met rijvergrendeling getrokken, niet uit een UUID of een
 * timestamp.
 */
export const receiptLineSchema = z.object({
  nameNl: z.string(),
  nameFr: z.string(),
  quantity: z.number().int().positive(),
  unitPriceInclCents: z.number().int().nonnegative(),
  lineTotalInclCents: z.number().int().nonnegative(),
  vatRate: z.number(),
});

export const receiptSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  invoiceNumber: z.string(),
  issuedAt: z.string().datetime(),

  storeName: z.string(),
  storeAddress: z.string(),
  /** BTW-nummer van de uitbater, bv. "BE 0123.456.789". Verplicht op de bon. */
  storeVatNumber: z.string(),

  lines: z.array(receiptLineSchema),
  vatBuckets: z.array(vatBucketSchema),
  totalExclCents: z.number().int().nonnegative(),
  totalVatCents: z.number().int().nonnegative(),
  totalInclCents: z.number().int().nonnegative(),

  paymentMethod: paymentMethodSchema,
  paidAt: z.string().datetime().nullable(),
});
export type Receipt = z.infer<typeof receiptSchema>;
