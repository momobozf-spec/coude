import type {
  BasketMatchType,
  DataOrigin,
  DietaryAttribute,
  EntitlementSet,
  EquivalenceStatus,
  ListMemberRole,
  Locale,
  MatchConfidence,
  MatchStatus,
  NotificationType,
  PromotionMechanic,
  PromotionParams,
  ProviderSupportStatus,
  RetailerType,
  SyncStatus,
  UserRole,
} from '@superrette/domain';

/**
 * Response DTOs. Prices are integer cents; dates are ISO strings.
 * Every price carries its data origin so clients can label sample or
 * crowdsourced data honestly.
 */

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  locale: Locale;
  countryCode: string | null;
  onboardingCompleted: boolean;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CountryDto {
  code: string;
  name: Record<Locale, string>;
  currency: string;
  languages: Locale[];
  defaultLocale: Locale;
}

export interface RetailerDto {
  id: string;
  slug: string;
  name: string;
  type: RetailerType;
  brandColor: string;
  loyaltyProgram: string | null;
  loyaltyProgramName: string | null;
  countries: string[];
  dataSupport: ProviderSupportStatus;
}

export interface RetailerPreferenceDto {
  retailerId: string;
  hasLoyaltyCard: boolean;
}

export interface UnitPriceDto {
  cents: number;
  per: 'kg' | 'l' | 'piece';
}

export interface PromotionSummaryDto {
  id: string;
  label: string;
  mechanic: PromotionMechanic;
  params: PromotionParams;
  endsAt: string | null;
  loyaltyProgram: string | null;
  minQuantity: number | null;
}

export interface ProductSummaryDto {
  variantId: string;
  productId: string;
  name: string;
  brand: string | null;
  sizeLabel: string | null;
  imageUrl: string | null;
  categorySlug: string | null;
  dietary: DietaryAttribute[];
  /** Cheapest current effective price for one unit across the user's retailers. */
  cheapest: {
    retailerId: string;
    retailerName: string;
    priceCents: number;
    regularPriceCents: number;
    isPromotion: boolean;
    unitPrice: UnitPriceDto | null;
  } | null;
  retailerCount: number;
  dataOrigin: DataOrigin | null;
}

export interface SearchResponse {
  query: string;
  interpretedTokens: string[];
  total: number;
  items: ProductSummaryDto[];
  suggestion: string | null;
}

export interface OfferDto {
  retailer: { id: string; slug: string; name: string; brandColor: string };
  retailerProductId: string;
  title: string;
  priceCents: number;
  regularPriceCents: number;
  isPromotion: boolean;
  discountPercent: number;
  unitPrice: UnitPriceDto | null;
  regularUnitPrice: UnitPriceDto | null;
  appliedPromotion: { id: string; label: string; mechanic: PromotionMechanic } | null;
  promotions: PromotionSummaryDto[];
  /** Promotions the user would get with a loyalty card they don't have, or at a larger quantity. */
  missedPromotions: { label: string; reason: string; potentialPriceCents: number | null; minimumQuantity: number }[];
  isCheapest: boolean;
  observedAt: string;
  dataOrigin: DataOrigin;
  isAvailable: boolean;
}

export interface ProductDetailDto {
  variantId: string;
  productId: string;
  name: string;
  brand: string | null;
  isPrivateLabel: boolean;
  sizeLabel: string | null;
  netContent: { amount: number; unit: 'g' | 'ml' | 'piece' } | null;
  imageUrl: string | null;
  category: { slug: string; name: string } | null;
  dietary: DietaryAttribute[];
  gtins: string[];
  offers: OfferDto[];
  cheapest: OfferDto | null;
  otherSizes: { variantId: string; sizeLabel: string | null; name: string }[];
  isFavorite: boolean;
  alerts: PriceAlertDto[];
  dataOrigins: DataOrigin[];
}

export interface PriceHistoryDto {
  variantId: string;
  windowDays: number;
  current: { cents: number; isPromo: boolean; observedAt: string } | null;
  lowest: { cents: number; observedAt: string } | null;
  highest: { cents: number; observedAt: string } | null;
  averageCents: number | null;
  observationCount: number;
  coverage: number;
  isComplete: boolean;
  isHistoricalLow: boolean;
  series: { retailerId: string; retailerName: string; points: { date: string; cents: number; isPromo: boolean }[] }[];
  dataOrigins: DataOrigin[];
}

export interface EquivalentDto {
  variantId: string;
  name: string;
  brand: string | null;
  sizeLabel: string | null;
  matchType: 'EXACT' | 'EQUIVALENT';
  confidence: number;
  status: EquivalenceStatus;
  cheapestPriceCents: number | null;
}

export interface BarcodeLookupDto {
  gtin: string;
  status: 'FOUND' | 'UNKNOWN' | 'INVALID';
  product: ProductDetailDto | null;
  /** Non-authoritative metadata from Open Food Facts, only for UNKNOWN codes. */
  external: {
    source: 'open-food-facts';
    name: string | null;
    brand: string | null;
    quantity: string | null;
    imageUrl: string | null;
  } | null;
}

export interface ShoppingListItemDto {
  id: string;
  title: string;
  quantity: number;
  preferredVariantId: string | null;
  preferredVariantName: string | null;
  preferredBrand: string | null;
  notes: string | null;
  categorySlug: string | null;
  checked: boolean;
  checkedBy: string | null;
  position: number;
  version: number;
  updatedAt: string;
}

export interface ListMemberDto {
  userId: string;
  displayName: string;
  role: ListMemberRole;
}

export interface ShoppingListDto {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  role: ListMemberRole;
  itemCount: number;
  checkedCount: number;
  memberCount: number;
  updatedAt: string;
}

export interface ShoppingListDetailDto extends ShoppingListDto {
  items: ShoppingListItemDto[];
  members: ListMemberDto[];
}

export interface ListActivityDto {
  id: string;
  type: string;
  userDisplayName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface BasketChoiceDto {
  variantId: string;
  retailerProductId: string;
  name: string;
  brand: string | null;
  matchType: 'EXACT' | 'EQUIVALENT' | 'GENERIC';
  confidence: number;
  totalCents: number;
  regularTotalCents: number;
  perItemCents: number;
  unitPrice: UnitPriceDto | null;
  promotionLabel: string | null;
}

export interface BasketLineDto {
  itemId: string;
  title: string;
  quantity: number;
  status: BasketMatchType;
  confidence: number | null;
  selected: BasketChoiceDto | null;
  alternatives: BasketChoiceDto[];
}

export interface RetailerBasketDto {
  retailer: { id: string; name: string; brandColor: string };
  totalCents: number;
  regularTotalCents: number;
  savingsCents: number;
  foundCount: number;
  itemCount: number;
  isComplete: boolean;
  exactCount: number;
  equivalentCount: number;
  averageConfidence: number | null;
  lines: BasketLineDto[];
}

export interface BasketComparisonDto {
  listId: string;
  itemCount: number;
  cheapestCompleteRetailerId: string | null;
  retailers: RetailerBasketDto[];
  /** Plan limit on compared retailers (null = unlimited); extra retailers were left out. */
  retailerLimit: number | null;
  dataOrigins: DataOrigin[];
  computedAt: string;
}

export interface SmartPlanDto {
  retailers: { id: string; name: string; subtotalCents: number; itemIds: string[] }[];
  totalCents: number;
  adjustedTotalCents: number;
  foundCount: number;
  missingItemIds: string[];
}

export interface SmartBasketDto {
  listId: string;
  maxStores: number;
  singleStore: SmartPlanDto[];
  best: SmartPlanDto | null;
  bestSingleStore: SmartPlanDto | null;
  savingsCents: number;
  recommendCombining: boolean;
}

export interface PromotionDto {
  id: string;
  label: string;
  description: string | null;
  mechanic: PromotionMechanic;
  params: PromotionParams;
  retailer: { id: string; name: string; brandColor: string };
  variantId: string | null;
  productName: string;
  brand: string | null;
  sizeLabel: string | null;
  regularPriceCents: number;
  /** Effective per-item price at the promotion's minimum beneficial quantity. */
  promoPerItemCents: number;
  minimumQuantity: number;
  discountPercent: number;
  startsAt: string | null;
  endsAt: string | null;
  loyaltyProgram: string | null;
  categorySlug: string | null;
  isFavorite: boolean;
  dataOrigin: DataOrigin;
}

export interface PriceAlertDto {
  id: string;
  variantId: string;
  productName: string;
  retailerId: string | null;
  retailerName: string | null;
  targetPriceCents: number | null;
  promotionOnly: boolean;
  enabled: boolean;
  lastTriggeredAt: string | null;
  lastTriggeredPriceCents: number | null;
  currentBestPriceCents: number | null;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface FavoriteInsightDto {
  kind: 'DISCOUNTED' | 'PRICE_DROP' | 'HISTORICAL_LOW' | 'ALERT_TRIGGERED';
  previousPriceCents: number | null;
  discountPercent: number | null;
}

export interface FavoriteDto {
  product: ProductSummaryDto;
  insights: FavoriteInsightDto[];
  createdAt: string;
}

export interface HomeDto {
  displayName: string;
  favorites: FavoriteDto[];
  promotionsForYou: PromotionDto[];
  primaryList: ShoppingListDto | null;
  unreadNotifications: number;
  dataOrigins: DataOrigin[];
}

export interface EntitlementsDto {
  plans: string[];
  entitlements: EntitlementSet;
}

export interface InvitePreviewDto {
  listId: string;
  listName: string;
  invitedBy: string;
  role: ListMemberRole;
  valid: boolean;
}

export interface InviteDto {
  token: string;
  url: string;
  expiresAt: string;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminMatchDto {
  id: string;
  retailerProduct: { id: string; title: string; retailerName: string; gtins: string[]; quantityText: string | null };
  proposed: { variantId: string; name: string; gtins: string[] };
  confidence: MatchConfidence;
  score: number;
  status: MatchStatus;
  reasons: string[];
  alternatives: { variantId: string; name: string; score: number; confidence: string }[];
  createdAt: string;
}

export interface AdminEquivalenceDto {
  id: string;
  source: { variantId: string; name: string };
  target: { variantId: string; name: string };
  confidence: number;
  status: EquivalenceStatus;
  reasons: string[];
}

export interface AdminProviderDto {
  key: string;
  displayName: string;
  supportStatus: ProviderSupportStatus;
  reason: string | null;
  dataOrigin: DataOrigin;
  retailerSlugs: string[];
  enabled: boolean;
  lastSync: AdminSyncDto | null;
}

export interface AdminSyncDto {
  id: string;
  providerKey: string;
  kind: string;
  status: SyncStatus;
  startedAt: string | null;
  finishedAt: string | null;
  readCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errorSummary: string | null;
}

export interface AdminProviderErrorDto {
  id: string;
  syncId: string | null;
  providerKey: string;
  stage: string;
  externalId: string | null;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminStatsDto {
  retailers: number;
  products: number;
  variants: number;
  retailerProducts: number;
  priceObservations: number;
  activePromotions: number;
  pendingMatches: number;
  suggestedEquivalences: number;
  openErrors: number;
  users: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}
