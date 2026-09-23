/**
 * Enumerations are defined once as readonly tuples so that the database
 * (pg enums), validation (zod) and UI all share the exact same values.
 */

export const COUNTRY_CODES = ['BE', 'NL'] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number] | (string & {});

export const LOCALES = ['nl', 'fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const RETAILER_TYPES = [
  'SUPERMARKET',
  'DISCOUNTER',
  'ONLINE_GROCER',
  'CONVENIENCE',
  'DRUGSTORE',
  'ORGANIC',
] as const;
export type RetailerType = (typeof RETAILER_TYPES)[number];

/**
 * Where a piece of catalogue/price data came from. The UI must always be able
 * to tell a user whether a price is live, crowdsourced or sample data.
 */
export const DATA_ORIGINS = [
  'RETAILER_API', // official API or partner feed provided by the retailer
  'AFFILIATE_FEED', // product feed via an affiliate network
  'CROWDSOURCED', // e.g. Open Prices (Open Food Facts) contributions
  'OPEN_DATA', // e.g. Open Food Facts product metadata (no prices)
  'USER_SUBMITTED',
  'DEVELOPMENT_SEED', // fake sample data — never shown as live
] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const LIVE_DATA_ORIGINS: readonly DataOrigin[] = ['RETAILER_API', 'AFFILIATE_FEED'];

export function isSampleData(origin: DataOrigin): boolean {
  return origin === 'DEVELOPMENT_SEED';
}

export const PROVIDER_SUPPORT_STATUSES = ['SUPPORTED', 'EXPERIMENTAL', 'UNSUPPORTED'] as const;
export type ProviderSupportStatus = (typeof PROVIDER_SUPPORT_STATUSES)[number];

export const MATCH_CONFIDENCES = ['EXACT', 'HIGH', 'MEDIUM', 'LOW', 'UNMATCHED'] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCES)[number];

export const MATCH_METHODS = ['GTIN', 'CONFIRMED_MAPPING', 'ATTRIBUTES', 'FUZZY', 'MANUAL'] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

/** Lifecycle of a RetailerProduct -> Product link. */
export const MATCH_STATUSES = [
  'AUTO_ACCEPTED', // EXACT/HIGH, linked automatically
  'PENDING_REVIEW', // MEDIUM/LOW, awaiting a human
  'CONFIRMED', // approved by a human — persists across imports
  'REJECTED', // rejected by a human — never proposed again
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const EQUIVALENCE_STATUSES = ['SUGGESTED', 'CONFIRMED', 'REJECTED'] as const;
export type EquivalenceStatus = (typeof EQUIVALENCE_STATUSES)[number];

export const BASKET_MATCH_TYPES = ['EXACT', 'EQUIVALENT', 'GENERIC', 'USER_SELECTED', 'MISSING'] as const;
export type BasketMatchType = (typeof BASKET_MATCH_TYPES)[number];

export const PROMOTION_MECHANICS = [
  'PRICE_CUT', // fixed promotional unit price
  'PERCENT_OFF',
  'AMOUNT_OFF',
  'BUY_X_GET_Y_FREE', // 1+1 gratis, 2+1 gratis
  'MULTI_BUY_FIXED_PRICE', // 2 voor €5, 3 voor €10
  'NTH_ITEM_PERCENT_OFF', // 2e halve prijs, 2e aan -70%
] as const;
export type PromotionMechanic = (typeof PROMOTION_MECHANICS)[number];

export const SYNC_STATUSES = ['QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_KINDS = ['CATALOG', 'PRICES', 'PROMOTIONS', 'FULL'] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

export const LIST_MEMBER_ROLES = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export type ListMemberRole = (typeof LIST_MEMBER_ROLES)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const NOTIFICATION_TYPES = [
  'PRICE_ALERT',
  'FAVORITE_DISCOUNTED',
  'LIST_ACTIVITY',
  'LIST_INVITE',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const SUBSCRIPTION_STORES = ['APPLE_APP_STORE', 'GOOGLE_PLAY', 'MANUAL'] as const;
export type SubscriptionStore = (typeof SUBSCRIPTION_STORES)[number];

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'IN_GRACE_PERIOD', 'EXPIRED', 'CANCELED', 'REVOKED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const DIETARY_ATTRIBUTES = [
  'organic',
  'vegan',
  'vegetarian',
  'lactose_free',
  'gluten_free',
  'sugar_free',
  'halal',
  'light',
] as const;
export type DietaryAttribute = (typeof DIETARY_ATTRIBUTES)[number];
