import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  char,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { PromotionParams } from '@superrette/domain';
import {
  baseUnitEnum,
  catalog,
  dataOrigin,
  equivalenceStatus,
  matchConfidence,
  matchMethod,
  matchStatus,
  promotionMechanic,
  retailerType,
  unitEnum,
} from './enums.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export type LocalizedText = { nl: string; fr: string; en: string };

// ─── Reference data ──────────────────────────────────────────────────────────

export const countries = catalog.table('countries', {
  code: char('code', { length: 2 }).primaryKey(),
  name: jsonb('name').$type<LocalizedText>().notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  languages: text('languages').array().notNull(),
  defaultLocale: text('default_locale').notNull(),
  regions: jsonb('regions').$type<{ code: string; name: string }[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
});

export const retailers = catalog.table('retailers', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  type: retailerType('type').notNull(),
  providerKey: text('provider_key').notNull(),
  brandColor: text('brand_color').notNull(),
  loyaltyProgram: text('loyalty_program'),
  loyaltyProgramName: text('loyalty_program_name'),
  websiteUrl: text('website_url'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const retailerCountries = catalog.table(
  'retailer_countries',
  {
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
  },
  (t) => [primaryKey({ columns: [t.retailerId, t.countryCode] })],
);

export const storeLocations = catalog.table(
  'store_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    regionCode: text('region_code'),
    name: text('name').notNull(),
    street: text('street'),
    postalCode: text('postal_code'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    /** OpenStreetMap id, used to map crowdsourced Open Prices locations. */
    osmId: text('osm_id'),
    externalId: text('external_id'),
    ...timestamps,
  },
  (t) => [index('store_locations_retailer_idx').on(t.retailerId), uniqueIndex('store_locations_osm_idx').on(t.osmId)],
);

export const brands = catalog.table('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  impliesTokens: text('implies_tokens').array().notNull().default(sql`'{}'::text[]`),
  /** Set for private labels (huismerken) such as Boni (Colruyt) or AH. */
  privateLabelRetailerId: uuid('private_label_retailer_id').references(() => retailers.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const categories = catalog.table('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
  name: jsonb('name').$type<LocalizedText>().notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Normaliser vocabulary extensions managed by admins. */
export const synonyms = catalog.table(
  'synonyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phrase: text('phrase').notNull(),
    token: text('token').notNull(),
    locale: text('locale'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('synonyms_phrase_idx').on(t.phrase)],
);

// ─── Canonical products ──────────────────────────────────────────────────────

/**
 * Product: the canonical, retailer-independent product *line*
 * (e.g. "Coca-Cola Zero Sugar"). Size-independent.
 */
export const products = catalog.table(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    productType: text('product_type'),
    variantTokens: text('variant_tokens').array().notNull().default(sql`'{}'::text[]`),
    flavours: text('flavours').array().notNull().default(sql`'{}'::text[]`),
    dietary: text('dietary').array().notNull().default(sql`'{}'::text[]`),
    description: text('description'),
    imageUrl: text('image_url'),
    dataOrigin: dataOrigin('data_origin').notNull(),
    ...timestamps,
  },
  (t) => [index('products_brand_idx').on(t.brandId), index('products_type_idx').on(t.productType)],
);

/**
 * ProductVariant: the concrete, comparable canonical item — a product in a
 * specific size/pack (e.g. "Coca-Cola Zero Sugar 1,5 L"). Prices, favourites,
 * alerts, list items and matches all reference variants.
 */
export const productVariants = catalog.table(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    quantityAmount: numeric('quantity_amount', { mode: 'number' }),
    quantityUnit: unitEnum('quantity_unit'),
    packCount: integer('pack_count').notNull().default(1),
    netContentAmount: numeric('net_content_amount', { mode: 'number' }),
    netContentUnit: baseUnitEnum('net_content_unit'),
    soldByWeight: boolean('sold_by_weight').notNull().default(false),
    sizeLabel: text('size_label'),
    /** Canonical tokens (synonyms resolved) for search and equivalence. */
    tokens: text('tokens').array().notNull().default(sql`'{}'::text[]`),
    /** Normalised searchable text: brand + name + tokens. */
    searchText: text('search_text').notNull(),
    signature: text('signature').notNull(),
    /** ProductNormalizer output used as the matching/equivalence representation. */
    normalized: jsonb('normalized').$type<Record<string, unknown>>().notNull(),
    /** Created automatically from an unmatched retailer product; awaits review. */
    needsReview: boolean('needs_review').notNull().default(false),
    imageUrl: text('image_url'),
    dataOrigin: dataOrigin('data_origin').notNull(),
    ...timestamps,
  },
  (t) => [
    index('product_variants_product_idx').on(t.productId),
    index('product_variants_signature_idx').on(t.signature),
    index('product_variants_search_trgm_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
    index('product_variants_tokens_idx').using('gin', t.tokens),
  ],
);

export const productBarcodes = catalog.table(
  'product_barcodes',
  {
    gtin: text('gtin').primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('product_barcodes_variant_idx').on(t.variantId)],
);

// ─── Retailer-specific data ──────────────────────────────────────────────────

/** RetailerProduct: a retailer's own listing, linked to a canonical variant. */
export const retailerProducts = catalog.table(
  'retailer_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    retailerSku: text('retailer_sku').notNull(),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    brandText: text('brand_text'),
    quantityText: text('quantity_text'),
    categoryText: text('category_text'),
    gtins: text('gtins').array().notNull().default(sql`'{}'::text[]`),
    imageUrl: text('image_url'),
    productUrl: text('product_url'),
    isAvailable: boolean('is_available').notNull().default(true),
    /** Snapshot of the ProductNormalizer output, for audit and re-matching. */
    normalized: jsonb('normalized').$type<Record<string, unknown>>(),
    dataOrigin: dataOrigin('data_origin').notNull(),
    sourceProvider: text('source_provider').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('retailer_products_sku_idx').on(t.retailerId, t.retailerSku),
    index('retailer_products_variant_idx').on(t.variantId),
  ],
);

/** PriceObservation: append-only price history. */
export const priceObservations = catalog.table(
  'price_observations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    retailerProductId: uuid('retailer_product_id')
      .notNull()
      .references(() => retailerProducts.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    regularPriceCents: integer('regular_price_cents').notNull(),
    promoPriceCents: integer('promo_price_cents'),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    labelledUnitPriceCents: integer('labelled_unit_price_cents'),
    storeLocationId: uuid('store_location_id').references(() => storeLocations.id, { onDelete: 'set null' }),
    dataOrigin: dataOrigin('data_origin').notNull(),
    sourceProvider: text('source_provider').notNull(),
    syncId: uuid('sync_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('price_observations_rp_time_idx').on(t.retailerProductId, t.observedAt.desc()),
    uniqueIndex('price_observations_dedupe_idx').on(t.retailerProductId, t.observedAt, t.sourceProvider),
  ],
);

/** Read model: the latest known price per retailer product (maintained by ingestion). */
export const currentPrices = catalog.table('current_prices', {
  retailerProductId: uuid('retailer_product_id')
    .primaryKey()
    .references(() => retailerProducts.id, { onDelete: 'cascade' }),
  regularPriceCents: integer('regular_price_cents').notNull(),
  promoPriceCents: integer('promo_price_cents'),
  currency: char('currency', { length: 3 }).notNull().default('EUR'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  dataOrigin: dataOrigin('data_origin').notNull(),
  sourceProvider: text('source_provider').notNull(),
});

export const promotions = catalog.table(
  'promotions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    mechanic: promotionMechanic('mechanic').notNull(),
    params: jsonb('params').$type<PromotionParams>().notNull(),
    label: text('label').notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    dataOrigin: dataOrigin('data_origin').notNull(),
    sourceProvider: text('source_provider').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('promotions_external_idx').on(t.retailerId, t.externalId),
    index('promotions_window_idx').on(t.startsAt, t.endsAt),
  ],
);

export const promotionConditions = catalog.table('promotion_conditions', {
  promotionId: uuid('promotion_id')
    .primaryKey()
    .references(() => promotions.id, { onDelete: 'cascade' }),
  loyaltyCardRequired: boolean('loyalty_card_required').notNull().default(false),
  loyaltyProgram: text('loyalty_program'),
  minQuantity: integer('min_quantity'),
  maxQuantityPerCustomer: integer('max_quantity_per_customer'),
  onlineOnly: boolean('online_only').notNull().default(false),
  regionCodes: text('region_codes').array().notNull().default(sql`'{}'::text[]`),
});

export const promotionProducts = catalog.table(
  'promotion_products',
  {
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id, { onDelete: 'cascade' }),
    retailerProductId: uuid('retailer_product_id')
      .notNull()
      .references(() => retailerProducts.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.retailerProductId] }), index('promotion_products_rp_idx').on(t.retailerProductId)],
);

// ─── Matching ────────────────────────────────────────────────────────────────

/** ProductMatch: RetailerProduct -> ProductVariant link with confidence and review state. */
export const productMatches = catalog.table(
  'product_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    retailerProductId: uuid('retailer_product_id')
      .notNull()
      .references(() => retailerProducts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    confidence: matchConfidence('confidence').notNull(),
    method: matchMethod('method').notNull(),
    score: numeric('score', { mode: 'number', precision: 5, scale: 3 }).notNull(),
    status: matchStatus('status').notNull(),
    reasons: text('reasons').array().notNull().default(sql`'{}'::text[]`),
    alternatives: jsonb('alternatives').$type<{ variantId: string; score: number; confidence: string }[]>().notNull().default([]),
    /** Admin user id (app.users) — stored without FK to keep catalog free of personal data. */
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('product_matches_pair_idx').on(t.retailerProductId, t.variantId),
    index('product_matches_status_idx').on(t.status),
  ],
);

export const productEquivalences = catalog.table(
  'product_equivalences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceVariantId: uuid('source_variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    targetVariantId: uuid('target_variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    confidence: numeric('confidence', { mode: 'number', precision: 4, scale: 2 }).notNull(),
    status: equivalenceStatus('status').notNull().default('SUGGESTED'),
    reasons: text('reasons').array().notNull().default(sql`'{}'::text[]`),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('product_equivalences_pair_idx').on(t.sourceVariantId, t.targetVariantId),
    index('product_equivalences_target_idx').on(t.targetVariantId),
  ],
);

/** Anonymous aggregate search counts for "populaire zoekopdrachten" (no user ids). */
export const searchStats = catalog.table('search_stats', {
  query: text('query').primaryKey(),
  count: integer('count').notNull().default(0),
  lastSearchedAt: timestamp('last_searched_at', { withTimezone: true }).notNull().defaultNow(),
});
