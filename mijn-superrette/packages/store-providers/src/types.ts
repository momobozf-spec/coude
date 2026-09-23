import { z } from 'zod';
import { DATA_ORIGINS, PROMOTION_MECHANICS, type DataOrigin, type ProviderSupportStatus } from '@superrette/domain';

/**
 * Raw shapes a StoreProvider emits. The ingestion pipeline validates every
 * record against these schemas before it touches the database.
 */

export const providerProductSchema = z.object({
  externalId: z.string().min(1).max(200),
  retailerSlug: z.string().min(1),
  title: z.string().min(1).max(300),
  brand: z.string().max(120).nullish(),
  quantityText: z.string().max(120).nullish(),
  gtins: z.array(z.string().max(20)).default([]),
  categoryText: z.string().max(200).nullish(),
  imageUrl: z.url().nullish(),
  productUrl: z.url().nullish(),
  isAvailable: z.boolean().default(true),
});
export type ProviderProduct = z.input<typeof providerProductSchema>;
export type ValidProviderProduct = z.output<typeof providerProductSchema>;

export const providerPriceSchema = z
  .object({
    externalId: z.string().min(1).max(200),
    retailerSlug: z.string().min(1),
    observedAt: z.date(),
    regularPriceCents: z.number().int().positive().max(1_000_000),
    promoPriceCents: z.number().int().positive().max(1_000_000).nullish(),
    currency: z.string().length(3).default('EUR'),
    labelledUnitPriceCents: z.number().int().positive().nullish(),
    storeOsmId: z.string().nullish(),
    /** Price sources that also identify the product (e.g. Open Prices). */
    product: providerProductSchema.optional(),
  })
  .refine((p) => p.promoPriceCents == null || p.promoPriceCents <= p.regularPriceCents, {
    message: 'promoPriceCents must not exceed regularPriceCents',
    path: ['promoPriceCents'],
  });
export type ProviderPrice = z.input<typeof providerPriceSchema>;
export type ValidProviderPrice = z.output<typeof providerPriceSchema>;

const promotionParamsSchema = z.discriminatedUnion('mechanic', [
  z.object({ mechanic: z.literal('PRICE_CUT'), promoPriceCents: z.number().int().positive() }),
  z.object({ mechanic: z.literal('PERCENT_OFF'), percent: z.number().gt(0).lte(100) }),
  z.object({ mechanic: z.literal('AMOUNT_OFF'), amountCents: z.number().int().positive() }),
  z.object({ mechanic: z.literal('BUY_X_GET_Y_FREE'), buy: z.number().int().min(1), free: z.number().int().min(1) }),
  z.object({
    mechanic: z.literal('MULTI_BUY_FIXED_PRICE'),
    quantity: z.number().int().min(2),
    totalCents: z.number().int().positive(),
  }),
  z.object({
    mechanic: z.literal('NTH_ITEM_PERCENT_OFF'),
    nth: z.number().int().min(2),
    percent: z.number().gt(0).lte(100),
  }),
]);

export const providerPromotionSchema = z.object({
  externalId: z.string().min(1).max(200),
  retailerSlug: z.string().min(1),
  productExternalIds: z.array(z.string().min(1)).min(1),
  params: promotionParamsSchema,
  label: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  startsAt: z.date().nullish(),
  endsAt: z.date().nullish(),
  conditions: z
    .object({
      loyaltyCardRequired: z.boolean().default(false),
      loyaltyProgram: z.string().nullish(),
      minQuantity: z.number().int().min(1).nullish(),
      maxQuantityPerCustomer: z.number().int().min(1).nullish(),
      onlineOnly: z.boolean().default(false),
      regionCodes: z.array(z.string()).default([]),
    })
    .default({ loyaltyCardRequired: false, onlineOnly: false, regionCodes: [] }),
});
export type ProviderPromotion = z.input<typeof providerPromotionSchema>;
export type ValidProviderPromotion = z.output<typeof providerPromotionSchema>;

export interface ProviderCategory {
  externalId: string;
  name: string;
  parentExternalId?: string | null;
}

export interface ProviderAvailability {
  externalId: string;
  isAvailable: boolean;
  storeId?: string | null;
}

export const PROVIDER_CAPABILITIES = [
  'searchProducts',
  'getProduct',
  'getPrices',
  'getPromotions',
  'getCategories',
  'getAvailability',
  'listCatalog',
] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export interface ProviderInfo {
  key: string;
  displayName: string;
  /** Retailers whose data this provider can deliver. */
  retailerSlugs: string[];
  supportStatus: ProviderSupportStatus;
  /** Required for UNSUPPORTED/EXPERIMENTAL: why, and what would be needed. */
  reason: string | null;
  dataOrigin: DataOrigin;
  capabilities: ProviderCapability[];
  documentation: string;
}

export interface PriceRequest {
  /** Retailer product ids to refresh. */
  externalIds?: string[];
  /** GTINs of interest (for barcode-keyed sources such as Open Prices). */
  gtins?: string[];
  since?: Date;
}

export interface SearchOptions {
  limit?: number;
}

/**
 * The contract every retailer integration implements. Methods that a
 * provider cannot legally or technically support must throw
 * ProviderUnsupportedError / ProviderCapabilityError — never return fake data.
 */
export interface StoreProvider {
  readonly info: ProviderInfo;
  searchProducts(query: string, options?: SearchOptions): Promise<ProviderProduct[]>;
  getProduct(externalId: string): Promise<ProviderProduct | null>;
  getPrices(request: PriceRequest): AsyncIterable<ProviderPrice>;
  getPromotions(request?: { since?: Date }): AsyncIterable<ProviderPromotion>;
  getCategories(): Promise<ProviderCategory[]>;
  getAvailability(externalIds: string[], options?: { storeId?: string }): Promise<ProviderAvailability[]>;
  /** Full catalogue listing for CATALOG syncs. */
  listCatalog(): AsyncIterable<ProviderProduct>;
}

export const dataOriginSchema = z.enum(DATA_ORIGINS);
export const promotionMechanicSchema = z.enum(PROMOTION_MECHANICS);
