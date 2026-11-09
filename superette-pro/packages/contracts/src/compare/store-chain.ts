import { z } from 'zod';
import { dataSourceKindSchema } from './enums';

/**
 * Status van de gegevens van een keten, bepaald door de API en nooit door de
 * app geraden:
 *
 *   LIVE        — toegestane bron, voorwaarden nagekeken, geslaagde import, recent
 *   DEMO        — verzonnen gegevens
 *   STALE       — ooit geïmporteerd maar te lang niet ververst
 *   UNVERIFIED  — echte gegevens, maar de bron verklaarde haar voorwaarden niet nagekeken
 *   UNAVAILABLE — geen (geslaagde) import
 */
export const SOURCE_STATUSES = ['LIVE', 'DEMO', 'STALE', 'UNVERIFIED', 'UNAVAILABLE'] as const;
export const sourceStatusSchema = z.enum(SOURCE_STATUSES);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

/** Een supermarktketen zoals de app hem toont. */
export const storeChainSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  /** Naam van de klantenkaart, bv. "Xtra" of "SuperPlus". `null` als de keten er geen heeft. */
  loyaltyCardName: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  /** Herkomst van de gegevens die we voor deze keten hebben. `null` als er nog geen import was. */
  dataSourceKind: dataSourceKindSchema.nullable(),
  /** ISO-8601 van de laatste geslaagde import. */
  lastImportedAt: z.string().datetime().nullable(),
  sourceStatus: sourceStatusSchema,
  /** `true` alleen bij LIVE: toegestane bron, voorwaarden nagekeken, geslaagde en recente import. */
  isLive: z.boolean(),
});
export type StoreChain = z.infer<typeof storeChainSchema>;

/** Verkorte verwijzing naar een keten in resultaten. */
export const storeChainRefSchema = storeChainSchema.pick({ id: true, slug: true, name: true, logoUrl: true });
export type StoreChainRef = z.infer<typeof storeChainRefSchema>;

export const storeLocationSchema = z.object({
  id: z.string(),
  storeChainId: z.string(),
  name: z.string(),
  address: z.string(),
  /** Belgische postcode, vier cijfers. */
  postalCode: z.string(),
  city: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** Vrije omschrijving van het bedieningsgebied, bv. "Antwerpen en rand". */
  serviceArea: z.string().nullable(),
  active: z.boolean(),
});
export type StoreLocation = z.infer<typeof storeLocationSchema>;

export const storeLocationRefSchema = storeLocationSchema.pick({ id: true, name: true, city: true, postalCode: true });
export type StoreLocationRef = z.infer<typeof storeLocationRefSchema>;

/** Belgische postcode: 1000–9999. */
export const belgianPostalCodeSchema = z
  .string()
  .regex(/^[1-9]\d{3}$/, 'Een Belgische postcode bestaat uit vier cijfers, bv. 2000');
