import { z } from 'zod';
import { NORMALIZED_UNITS, PACKAGE_UNITS } from '@superette/pricing';

/**
 * Vaste waardenlijsten van de supermarktvergelijker.
 *
 * De Prisma-enums in `apps/api/prisma/schema.prisma` spiegelen deze lijsten
 * één op één. Voeg je hier een waarde toe, voeg hem dan ook daar toe — de
 * API-typecheck faalt anders op de mapping, en dat is de bedoeling.
 */

export const packageUnitSchema = z.enum(PACKAGE_UNITS);
export type PackageUnit = z.infer<typeof packageUnitSchema>;

export const normalizedUnitSchema = z.enum(NORMALIZED_UNITS);
export type NormalizedUnit = z.infer<typeof normalizedUnitSchema>;

/**
 * Hoe een aanbieding geclassificeerd wordt voor de gebruiker. Dit is de
 * *soort* promotie; de rekenregel staat apart in `promotionRuleSchema`.
 */
export const PROMOTION_TYPES = [
  /** Gewone schapprijs. */
  'NONE',
  /** Tijdelijke promotie, voor iedereen. */
  'TEMPORARY',
  /** Alleen met de klantenkaart van de keten. */
  'LOYALTY_CARD',
  /** Persoonlijke aanbieding, afhankelijk van het profiel van de klant. */
  'PERSONALIZED',
  /** Vast bedrag voor een vast aantal ("2 voor €5"). */
  'MULTIBUY',
  /** Staffelkorting vanaf een minimumaantal. */
  'VOLUME_DISCOUNT',
  /** "1+1 gratis", "2+1 gratis". */
  'BUY_X_GET_Y',
  /** Procentuele korting. */
  'PERCENTAGE',
  /** Alleen geldig in de webshop. */
  'ONLINE_ONLY',
  /** Alleen in bepaalde regio's of filialen. */
  'REGIONAL',
] as const;
export const promotionTypeSchema = z.enum(PROMOTION_TYPES);
export type PromotionType = z.infer<typeof promotionTypeSchema>;

/** Waar een prijs geldt. */
export const OFFER_CHANNELS = ['IN_STORE', 'ONLINE', 'BOTH'] as const;
export const offerChannelSchema = z.enum(OFFER_CHANNELS);
export type OfferChannel = z.infer<typeof offerChannelSchema>;

/**
 * Herkomst van prijsgegevens. Bepaalt wat we de gebruiker erbij vertellen:
 * `DEMO` wordt nooit als actuele winkelprijs voorgesteld.
 */
export const DATA_SOURCE_KINDS = ['DEMO', 'IMPORT_FILE', 'OFFICIAL_API', 'MERCHANT_FEED', 'PARTNER_FEED', 'MANUAL'] as const;
export const dataSourceKindSchema = z.enum(DATA_SOURCE_KINDS);
export type DataSourceKind = z.infer<typeof dataSourceKindSchema>;

/** Status van een zichtbare prijs, afgeleid uit bron en leeftijd. */
export const PRICE_STATUSES = [
  /** Recent gecontroleerd uit een betrouwbare bron. */
  'CURRENT',
  /** Ouder dan de versheidsgrens; kan intussen gewijzigd zijn. */
  'STALE',
  /** De geldigheidsperiode is voorbij. */
  'EXPIRED',
  /** Demogegevens, geen echte winkelprijs. */
  'DEMO',
  /** Bron met lage betrouwbaarheid of handmatige invoer. */
  'UNVERIFIED',
] as const;
export const priceStatusSchema = z.enum(PRICE_STATUSES);
export type PriceStatus = z.infer<typeof priceStatusSchema>;

export const BRAND_TYPES = ['NATIONAL_BRAND', 'STORE_BRAND', 'UNKNOWN'] as const;
export const brandTypeSchema = z.enum(BRAND_TYPES);
export type BrandType = z.infer<typeof brandTypeSchema>;

/**
 * Hoe twee producten zich tot elkaar verhouden.
 *
 *   EXACT       — hetzelfde product, dezelfde verpakking
 *   EQUIVALENT  — hetzelfde product, andere verpakkingsgrootte
 *   ALTERNATIVE — vergelijkbaar alternatief (bv. huismerk)
 *   UNCERTAIN   — onvoldoende zekerheid; menselijke controle vereist
 */
export const MATCH_TYPES = ['EXACT', 'EQUIVALENT', 'ALTERNATIVE', 'UNCERTAIN'] as const;
export const matchTypeSchema = z.enum(MATCH_TYPES);
export type MatchType = z.infer<typeof matchTypeSchema>;

export const MATCH_STATUSES = ['AUTO', 'CONFIRMED', 'REJECTED'] as const;
export const matchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const AVAILABILITIES = ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'] as const;
export const availabilitySchema = z.enum(AVAILABILITIES);
export type Availability = z.infer<typeof availabilitySchema>;

/** Rekenregel van een promotie. Spiegelt `PromotionRule` uit `@superette/pricing`. */
export const promotionRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({ kind: z.literal('FIXED_PRICE'), priceCents: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('PERCENTAGE'), percent: z.number().positive().max(100) }),
  z.object({ kind: z.literal('BUY_X_GET_Y_FREE'), buy: z.number().int().positive(), free: z.number().int().positive() }),
  z.object({ kind: z.literal('MULTIBUY'), quantity: z.number().int().min(2), totalCents: z.number().int().nonnegative() }),
  z.object({
    kind: z.literal('VOLUME_DISCOUNT'),
    minimumQuantity: z.number().int().positive(),
    unitPriceCents: z.number().int().nonnegative(),
  }),
  z.object({ kind: z.literal('NTH_AT_DISCOUNT'), nth: z.number().int().min(2), percent: z.number().positive().max(100) }),
]);
export type PromotionRuleInput = z.infer<typeof promotionRuleSchema>;

/** Een bedrag in centen zoals het de API binnenkomt. Nooit een float. */
export const centsSchema = z.number().int().nonnegative();
export const positiveCentsSchema = z.number().int().positive('Bedrag moet groter zijn dan nul');
