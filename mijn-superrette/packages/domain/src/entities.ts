import type { BaseUnit, Cents, CurrencyCode, Quantity } from '@superrette/shared';
import type {
  CountryCode,
  DataOrigin,
  DietaryAttribute,
  Locale,
  MatchConfidence,
  PromotionMechanic,
  RetailerType,
} from './enums.js';

/**
 * Platform-independent domain shapes. Persistence (Drizzle) and transport
 * (Zod) layers map onto these; engines only depend on these shapes.
 */

export interface CountryConfig {
  code: CountryCode;
  name: Record<Locale, string>;
  currency: CurrencyCode;
  languages: Locale[];
  defaultLocale: Locale;
  regions: { code: string; name: string }[];
}

export interface RetailerConfig {
  id: string;
  slug: string;
  name: string;
  type: RetailerType;
  countries: CountryCode[];
  /** Provider key used by the ingestion pipeline, e.g. "colruyt". */
  providerKey: string;
  brandColor: string;
  loyaltyProgram: string | null;
  isActive: boolean;
}

/** Canonical, retailer-independent product. */
export interface CanonicalProduct {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  isPrivateLabel: boolean;
  categoryId: string | null;
  categoryPath: string[];
  /** Product type slug used for equivalence, e.g. "milk-semi-skimmed". */
  productType: string | null;
  variant: string | null;
  flavour: string | null;
  quantity: Quantity | null;
  packCount: number;
  /** Total content in base units (packCount * quantity). */
  netContent: { amount: number; unit: BaseUnit } | null;
  dietary: DietaryAttribute[];
  gtins: string[];
  imageUrl: string | null;
}

/** The retailer's own listing of a product. */
export interface RetailerProductRecord {
  id: string;
  retailerId: string;
  retailerSku: string;
  productId: string | null;
  title: string;
  brandName: string | null;
  gtins: string[];
  quantityText: string | null;
  categoryText: string | null;
  isAvailable: boolean;
  dataOrigin: DataOrigin;
}

export interface PriceObservationRecord {
  retailerProductId: string;
  observedAt: Date;
  /** Regular shelf price for one unit. */
  regularPriceCents: Cents;
  /** Promotional unit price if the shelf price is currently reduced. */
  promoPriceCents: Cents | null;
  currency: CurrencyCode;
  /** Price per kg/l/piece as labelled by the retailer, when provided. */
  labelledUnitPriceCents: Cents | null;
  dataOrigin: DataOrigin;
  sourceProvider: string;
}

export interface PromotionCondition {
  loyaltyCardRequired: boolean;
  loyaltyProgram: string | null;
  minQuantity: number | null;
  maxQuantityPerCustomer: number | null;
  onlineOnly: boolean;
  regionCodes: string[];
}

export interface PromotionRecord {
  id: string;
  retailerId: string;
  retailerProductIds: string[];
  mechanic: PromotionMechanic;
  /** Mechanic specific parameters, see PromotionParams. */
  params: PromotionParams;
  label: string;
  startsAt: Date | null;
  endsAt: Date | null;
  conditions: PromotionCondition;
  dataOrigin: DataOrigin;
}

export type PromotionParams =
  | { mechanic: 'PRICE_CUT'; promoPriceCents: Cents }
  | { mechanic: 'PERCENT_OFF'; percent: number }
  | { mechanic: 'AMOUNT_OFF'; amountCents: Cents }
  | { mechanic: 'BUY_X_GET_Y_FREE'; buy: number; free: number }
  | { mechanic: 'MULTI_BUY_FIXED_PRICE'; quantity: number; totalCents: Cents }
  | { mechanic: 'NTH_ITEM_PERCENT_OFF'; nth: number; percent: number };

export interface ProductMatchProposal {
  retailerProductId: string;
  productId: string | null;
  confidence: MatchConfidence;
  score: number;
  reasons: string[];
}
