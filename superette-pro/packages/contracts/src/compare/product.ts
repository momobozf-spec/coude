import { z } from 'zod';
import {
  availabilitySchema,
  brandTypeSchema,
  dataSourceKindSchema,
  matchTypeSchema,
  normalizedUnitSchema,
  offerChannelSchema,
  priceStatusSchema,
  promotionRuleSchema,
  promotionTypeSchema,
} from './enums';
import { storeChainRefSchema, storeLocationRefSchema } from './store-chain';

/**
 * Herkomst en actualiteit van één prijs. Elke zichtbare prijs draagt dit mee;
 * de app toont het naast het bedrag. Zonder herkomst is een prijs een gerucht.
 */
export const provenanceSchema = z.object({
  sourceKind: dataSourceKindSchema,
  /** Leesbare bronnaam, bv. "Demogegevens" of "Officiële feed Colruyt". */
  sourceLabel: z.string(),
  /** Verwijzing in de bron (sku, feed-id, url). */
  sourceReference: z.string().nullable(),
  /** Laatste controlemoment, ISO-8601. */
  observedAt: z.string().datetime(),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  /** 0–1. Hoe zeker we zijn van deze prijs. */
  confidence: z.number().min(0).max(1),
  status: priceStatusSchema,
  isDemo: z.boolean(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const unitPriceSchema = z.object({
  cents: z.number().int().nonnegative(),
  unit: normalizedUnitSchema,
});

/** Een prijs voor een product bij een keten (en eventueel filiaal). */
export const productOfferSchema = z.object({
  id: z.string(),
  storeChain: storeChainRefSchema,
  storeLocation: storeLocationRefSchema.nullable(),
  /** Naam zoals de keten het product noemt. */
  storeProductName: z.string(),
  productUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),

  /** Verpakkingsprijs in centen, voor één verpakking, zonder statiegeld. */
  priceCents: z.number().int().nonnegative(),
  /** Prijs vóór promotie, als die er is. */
  originalPriceCents: z.number().int().nonnegative().nullable(),
  discountPercentage: z.number().int().nullable(),
  /** Prijs per kg / l / stuk op basis van `priceCents`. `null` als niet berekenbaar. */
  unitPrice: unitPriceSchema.nullable(),
  /** Waarom er geen eenheidsprijs is, in gewone taal. */
  unitPriceUnavailableReason: z.string().nullable(),

  promotionType: promotionTypeSchema,
  /** Kort label, bv. "1+1 gratis". */
  promotionLabel: z.string().nullable(),
  promotionRule: promotionRuleSchema.nullable(),
  /** Vrije voorwaardentekst uit de bron. */
  conditions: z.string().nullable(),
  requiresLoyaltyCard: z.boolean(),
  isPersonalized: z.boolean(),
  channel: offerChannelSchema,
  /** Vanaf hoeveel verpakkingen de prijs geldt. 1 als er geen voorwaarde is. */
  minimumQuantity: z.number().int().positive(),
  /**
   * Laagste haalbare prijs per verpakking mét de promotie, en bij welk aantal.
   * Alleen aanwezig als de promotie voorwaardelijk is of een korting oplevert.
   */
  effectivePrice: z
    .object({
      unitCents: z.number().int().nonnegative(),
      atQuantity: z.number().int().positive(),
      conditional: z.boolean(),
      /** Eenheidsprijs (per kg/l/stuk) bij die effectieve prijs. */
      unitPrice: unitPriceSchema.nullable(),
    })
    .nullable(),
  depositCents: z.number().int().nonnegative().nullable(),
  availability: availabilitySchema,
  provenance: provenanceSchema,
});
export type ProductOffer = z.infer<typeof productOfferSchema>;

/** Een canoniek product (keten-onafhankelijk), zoals in resultaten getoond. */
export const catalogProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  brandType: brandTypeSchema,
  categoryId: z.string().nullable(),
  categorySlug: z.string().nullable(),
  categoryName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  barcode: z.string().nullable(),
  /** Leesbare inhoud, bv. "1,5 l" of "6 × 33 cl". "Inhoud onbekend" als de bron niets meegaf. */
  packageLabel: z.string(),
  /** Totale inhoud in basiseenheid (g / ml / stuk). `null` als onbekend; dan geen eenheidsprijs. */
  normalizedQuantity: z.number().int().positive().nullable(),
  normalizedUnit: normalizedUnitSchema.nullable(),
  packCount: z.number().int().positive(),
});
export type CatalogProductSummary = z.infer<typeof catalogProductSummarySchema>;

export const catalogCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameNl: z.string(),
  nameFr: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type CatalogCategory = z.infer<typeof catalogCategorySchema>;

/** Hoe goed de gegevens van de gevraagde ketens gedekt zijn. */
export const coverageSchema = z.object({
  chainsRequested: z.number().int().nonnegative(),
  chainsWithData: z.number().int().nonnegative(),
  chains: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      hasData: z.boolean(),
      lastObservedAt: z.string().datetime().nullable(),
      sourceKind: dataSourceKindSchema.nullable(),
      /** Verklaarde de bron van de laatste import dat haar voorwaarden zijn nagekeken? */
      termsReviewed: z.boolean(),
    }),
  ),
  /** "Prijzen van 5 van de 7 geselecteerde supermarkten zijn gecontroleerd." */
  summary: z.string(),
});
export type Coverage = z.infer<typeof coverageSchema>;

export const SEARCH_SORTS = ['UNIT_PRICE', 'PACKAGE_PRICE', 'DISCOUNT', 'STORE', 'RELEVANCE'] as const;
export const searchSortSchema = z.enum(SEARCH_SORTS);
export type SearchSort = z.infer<typeof searchSortSchema>;

/** Een kommagescheiden lijst in een queryparameter → array van slugs. */
export const slugListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [] as string[];
    const list = Array.isArray(value) ? value : value.split(',');
    return list.map((v) => v.trim().toLowerCase()).filter((v) => /^[a-z0-9-]{1,40}$/.test(v));
  });

const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((value) => value === true || value === 'true' || value === '1');

/** Queryparameters van `GET /compare/search`. */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Geef een zoekterm op').max(120),
  chains: slugListSchema,
  category: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(60).optional(),
  brandType: brandTypeSchema.optional(),
  onlyPromotions: booleanQuery,
  /** `REQUIRED` toont alleen klantenkaartprijzen, `NOT_REQUIRED` sluit ze uit. */
  loyaltyCard: z.enum(['ANY', 'REQUIRED', 'NOT_REQUIRED']).default('ANY'),
  unit: normalizedUnitSchema.optional(),
  availability: availabilitySchema.optional(),
  maxPriceCents: z.coerce.number().int().positive().optional(),
  includePersonalized: booleanQuery,
  includeOnline: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => value === undefined || value === true || value === 'true' || value === '1'),
  /** Onzekere matches worden standaard niet als vergelijking getoond. */
  includeUncertain: booleanQuery,
  sort: searchSortSchema.default('UNIT_PRICE'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

export const searchResultItemSchema = z.object({
  product: catalogProductSummarySchema,
  /** Hoe dit product zich verhoudt tot de zoekterm/het ankerproduct. */
  matchType: matchTypeSchema,
  matchConfidence: z.number().min(0).max(1),
  offers: z.array(productOfferSchema),
  /** Het goedkoopste relevante aanbod volgens de sortering. */
  bestOffer: productOfferSchema.nullable(),
  /** Waarschuwing wanneer producten niet volledig vergelijkbaar zijn. */
  warning: z.string().nullable(),
  /**
   * Bevestigde of betrouwbare vergelijkingen bij ANDERE ketens (zelfde product
   * in andere verpakking, of een alternatief/huismerk), met het goedkoopste
   * aanbod per vergelijkbaar product. Nooit onzekere matches.
   */
  comparisons: z
    .array(
      z.object({
        product: catalogProductSummarySchema,
        matchType: matchTypeSchema,
        offer: productOfferSchema,
      }),
    )
    .optional(),
});
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  items: z.array(searchResultItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  sort: searchSortSchema,
  coverage: coverageSchema,
  /** Staat er minstens één demoprijs tussen de resultaten? */
  containsDemoData: z.boolean(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const relatedProductSchema = z.object({
  product: catalogProductSummarySchema,
  matchType: matchTypeSchema,
  matchConfidence: z.number().min(0).max(1),
  matchStatus: z.enum(['AUTO', 'CONFIRMED', 'REJECTED']),
  reason: z.string().nullable(),
  offers: z.array(productOfferSchema),
});
export type RelatedProduct = z.infer<typeof relatedProductSchema>;

export const priceHistoryPointSchema = z.object({
  observedAt: z.string().datetime(),
  storeChainSlug: z.string(),
  storeLocationId: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  originalPriceCents: z.number().int().nonnegative().nullable(),
  unitPriceCents: z.number().int().nonnegative().nullable(),
  promotionType: promotionTypeSchema,
  sourceKind: dataSourceKindSchema,
});
export type PriceHistoryPoint = z.infer<typeof priceHistoryPointSchema>;

export const priceHistorySummarySchema = z.object({
  /** Is er genoeg betrouwbare geschiedenis om te tonen? */
  sufficient: z.boolean(),
  periodDays: z.number().int().positive(),
  currentCents: z.number().int().nullable(),
  previousCents: z.number().int().nullable(),
  lowestCents: z.number().int().nullable(),
  highestCents: z.number().int().nullable(),
  averageCents: z.number().int().nullable(),
  points: z.array(priceHistoryPointSchema),
  promotionPeriods: z.array(
    z.object({
      storeChainSlug: z.string(),
      promotionType: promotionTypeSchema,
      from: z.string().datetime(),
      to: z.string().datetime(),
    }),
  ),
  /** Vaste disclaimer: meetmomenten, geen kassaprijzen. */
  disclaimer: z.string(),
});
export type PriceHistorySummary = z.infer<typeof priceHistorySummarySchema>;

export const productDetailSchema = z.object({
  product: catalogProductSummarySchema.extend({ description: z.string().nullable() }),
  /** Prijzen van exact dit product (zelfde verpakking) per keten. */
  offers: z.array(productOfferSchema),
  bestOffer: productOfferSchema.nullable(),
  equivalents: z.array(relatedProductSchema),
  alternatives: z.array(relatedProductSchema),
  /** Aantal onzekere matches dat we bewust niet tonen. */
  uncertainCount: z.number().int().nonnegative(),
  history: priceHistorySummarySchema.nullable(),
  coverage: coverageSchema,
  containsDemoData: z.boolean(),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

/** Queryparameters van `GET /compare/promotions`. */
export const promotionsQuerySchema = z.object({
  chains: slugListSchema,
  category: z.string().trim().max(60).optional(),
  includePersonalized: booleanQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;

export const reportMatchSchema = z.object({
  relatedProductId: z.string().min(1),
  reason: z.string().trim().min(3).max(300),
});
export type ReportMatchInput = z.infer<typeof reportMatchSchema>;
