import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import {
  brands,
  categories,
  loadOffers,
  productBarcodes,
  products,
  productVariants,
  resolveEntitlements,
  retailerCountries,
  retailers,
  userRetailerPreferences,
  users,
  type Database,
  type OfferRow,
} from '@superrette/database';
import type { DataOrigin, DietaryAttribute, EntitlementKey, Locale } from '@superrette/domain';
import { resolveLocale } from '@superrette/i18n';
import { createNormalizer } from '@superrette/ingestion';
import type { ProductNormalizer } from '@superrette/product-matching';
import { PricingEngine, type EffectivePrice, type PricingContext } from '@superrette/pricing-engine';
import type {
  EntitlementsDto,
  OfferDto,
  ProductSummaryDto,
  PromotionSummaryDto,
  UnitPriceDto,
} from '@superrette/validation';
import type { AppConfig } from '../config/config.js';
import { entitlementRequired, limitReached } from './errors.js';
import { CONFIG, DB } from './tokens.js';

// ─── Normaliser (dictionary from DB, refreshed periodically) ─────────────────

@Injectable()
export class NormalizerService {
  private cached: { normalizer: ProductNormalizer; loadedAt: number } | null = null;
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(): Promise<ProductNormalizer> {
    if (!this.cached || Date.now() - this.cached.loadedAt > 5 * 60_000) {
      this.cached = { normalizer: await createNormalizer(this.db), loadedAt: Date.now() };
    }
    return this.cached.normalizer;
  }

  invalidate(): void {
    this.cached = null;
  }
}

// ─── Entitlements ────────────────────────────────────────────────────────────

@Injectable()
export class EntitlementsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  get(userId: string): Promise<EntitlementsDto> {
    return resolveEntitlements(this.db, userId);
  }

  async has(userId: string, key: EntitlementKey): Promise<boolean> {
    return (await this.get(userId)).entitlements[key].enabled;
  }

  async require(userId: string, key: EntitlementKey): Promise<void> {
    if (!(await this.has(userId, key))) throw entitlementRequired(key);
  }

  /** Throws when `usage` has reached the limit for `key`. Returns the limit (null = unlimited). */
  async requireWithinLimit(userId: string, key: EntitlementKey, usage: number): Promise<number | null> {
    const grant = (await this.get(userId)).entitlements[key];
    if (!grant.enabled) throw entitlementRequired(key);
    if (grant.limit !== null && usage >= grant.limit) throw limitReached(key, grant.limit);
    return grant.limit;
  }

  async limit(userId: string, key: EntitlementKey): Promise<number | null> {
    const grant = (await this.get(userId)).entitlements[key];
    return grant.enabled ? grant.limit : 0;
  }
}

// ─── Shopper context ─────────────────────────────────────────────────────────

export interface ShopperContext {
  userId: string | null;
  locale: Locale;
  countryCode: string | null;
  /** Retailers to show prices for: the user's preferences, else all active retailers of the country. */
  retailerIds: string[];
  followedRetailerIds: string[];
  loyaltyPrograms: string[];
  pricing(at?: Date): PricingContext;
}

@Injectable()
export class ShopperContextService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(
    userId: string | null,
    overrides: { countryCode?: string | null; locale?: string | null } = {},
  ): Promise<ShopperContext> {
    let locale: Locale = resolveLocale(overrides.locale);
    let countryCode = overrides.countryCode ?? null;
    let followed: { retailerId: string; hasLoyaltyCard: boolean; loyaltyProgram: string | null }[] = [];
    if (userId) {
      const [user] = await this.db
        .select({ locale: users.locale, countryCode: users.countryCode })
        .from(users)
        .where(eq(users.id, userId));
      if (user) {
        locale = resolveLocale(user.locale);
        countryCode = user.countryCode ?? countryCode;
      }
      followed = await this.db
        .select({
          retailerId: userRetailerPreferences.retailerId,
          hasLoyaltyCard: userRetailerPreferences.hasLoyaltyCard,
          loyaltyProgram: retailers.loyaltyProgram,
        })
        .from(userRetailerPreferences)
        .innerJoin(retailers, eq(retailers.id, userRetailerPreferences.retailerId))
        .where(and(eq(userRetailerPreferences.userId, userId), eq(retailers.isActive, true)));
    }
    let retailerIds = followed.map((f) => f.retailerId);
    if (retailerIds.length === 0) {
      const rows = await this.db
        .selectDistinct({ id: retailers.id })
        .from(retailers)
        .innerJoin(retailerCountries, eq(retailerCountries.retailerId, retailers.id))
        .where(
          countryCode
            ? and(eq(retailers.isActive, true), eq(retailerCountries.countryCode, countryCode))
            : eq(retailers.isActive, true),
        );
      retailerIds = rows.map((r) => r.id);
    }
    const loyaltyPrograms = followed.filter((f) => f.hasLoyaltyCard && f.loyaltyProgram).map((f) => f.loyaltyProgram!);
    return {
      userId,
      locale,
      countryCode,
      retailerIds,
      followedRetailerIds: followed.map((f) => f.retailerId),
      loyaltyPrograms,
      pricing: (at = new Date()) => ({ at, loyaltyPrograms }),
    };
  }
}

// ─── Offers & presentation ───────────────────────────────────────────────────

export interface PricedOfferRow {
  row: OfferRow;
  price: EffectivePrice;
}

export const unitPriceDto = (u: EffectivePrice['unitPrice']): UnitPriceDto | null =>
  u ? { cents: u.cents, per: u.per } : null;

export function promotionSummary(p: OfferRow['promotions'][number]): PromotionSummaryDto {
  return {
    id: p.id,
    label: p.label,
    mechanic: p.params.mechanic,
    params: p.params,
    endsAt: p.endsAt?.toISOString() ?? null,
    loyaltyProgram: p.conditions.loyaltyCardRequired ? p.conditions.loyaltyProgram : null,
    minQuantity: p.conditions.minQuantity,
  };
}

export function offerDto(p: PricedOfferRow, isCheapest: boolean): OfferDto {
  const { row, price } = p;
  return {
    retailer: {
      id: row.retailer.id,
      slug: row.retailer.slug,
      name: row.retailer.name,
      brandColor: row.retailer.brandColor,
    },
    retailerProductId: row.retailerProduct.id,
    title: row.retailerProduct.title,
    priceCents: Math.round(price.perItemCents),
    regularPriceCents: row.offer.regularPriceCents,
    isPromotion: price.appliedPromotion !== null,
    discountPercent: price.discountPercent,
    unitPrice: unitPriceDto(price.unitPrice),
    regularUnitPrice: unitPriceDto(price.regularUnitPrice),
    appliedPromotion: price.appliedPromotion,
    promotions: row.promotions.map(promotionSummary),
    missedPromotions: price.missedPromotions.map((m) => ({
      label: m.label,
      reason: m.reason,
      potentialPriceCents: m.potentialTotalCents,
      minimumQuantity: m.minimumBeneficialQuantity,
    })),
    isCheapest,
    observedAt: row.observedAt.toISOString(),
    dataOrigin: row.dataOrigin,
    isAvailable: row.retailerProduct.isAvailable,
  };
}

export interface VariantBasics {
  variantId: string;
  productId: string;
  name: string;
  brand: string | null;
  isPrivateLabel: boolean;
  sizeLabel: string | null;
  imageUrl: string | null;
  categorySlug: string | null;
  categoryName: Record<string, string> | null;
  dietary: DietaryAttribute[];
  netAmount: number | null;
  netUnit: 'g' | 'ml' | 'piece' | null;
  dataOrigin: DataOrigin;
  productType: string | null;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  get origins(): DataOrigin[] {
    return this.config.dataOrigins;
  }

  async basics(variantIds: readonly string[]): Promise<Map<string, VariantBasics>> {
    if (variantIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        variantId: productVariants.id,
        productId: products.id,
        name: productVariants.displayName,
        brand: brands.name,
        privateLabel: brands.privateLabelRetailerId,
        sizeLabel: productVariants.sizeLabel,
        imageUrl: productVariants.imageUrl,
        categorySlug: categories.slug,
        categoryName: categories.name,
        dietary: products.dietary,
        netAmount: productVariants.netContentAmount,
        netUnit: productVariants.netContentUnit,
        dataOrigin: productVariants.dataOrigin,
        productType: products.productType,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(inArray(productVariants.id, [...variantIds]), inArray(productVariants.dataOrigin, this.origins)));
    return new Map(
      rows.map((r) => [
        r.variantId,
        {
          variantId: r.variantId,
          productId: r.productId,
          name: r.name,
          brand: r.brand,
          isPrivateLabel: r.privateLabel != null,
          sizeLabel: r.sizeLabel,
          imageUrl: r.imageUrl,
          categorySlug: r.categorySlug,
          categoryName: r.categoryName,
          dietary: r.dietary as DietaryAttribute[],
          netAmount: r.netAmount != null ? Number(r.netAmount) : null,
          netUnit: r.netUnit,
          dataOrigin: r.dataOrigin,
          productType: r.productType,
        },
      ]),
    );
  }

  async gtins(variantId: string): Promise<string[]> {
    const rows = await this.db
      .select({ gtin: productBarcodes.gtin })
      .from(productBarcodes)
      .where(eq(productBarcodes.variantId, variantId));
    return rows.map((r) => r.gtin);
  }

  /** Current offers for variants, priced for one unit (or `quantity`) with the shopper's context. */
  async pricedOffers(
    variantIds: readonly string[],
    shopper: ShopperContext,
    options: { retailerIds?: string[]; quantity?: number; at?: Date } = {},
  ): Promise<Map<string, PricedOfferRow[]>> {
    const at = options.at ?? new Date();
    const rows = await loadOffers(this.db, {
      variantIds,
      retailerIds: options.retailerIds ?? shopper.retailerIds,
      at,
      origins: this.origins,
    });
    const result = new Map<string, PricedOfferRow[]>();
    for (const row of rows) {
      const price = PricingEngine.calculateEffectivePrice(row.offer, options.quantity ?? 1, shopper.pricing(at));
      const list = result.get(row.variantId);
      const item = { row, price };
      if (list) list.push(item);
      else result.set(row.variantId, [item]);
    }
    for (const list of result.values())
      list.sort(
        (a, b) => a.price.totalCents - b.price.totalCents || a.row.retailer.name.localeCompare(b.row.retailer.name),
      );
    return result;
  }

  async summaries(variantIds: readonly string[], shopper: ShopperContext): Promise<ProductSummaryDto[]> {
    const [basics, offers] = await Promise.all([this.basics(variantIds), this.pricedOffers(variantIds, shopper)]);
    return variantIds
      .map((id) => basics.get(id))
      .filter((b): b is VariantBasics => b !== undefined)
      .map((b) => this.summary(b, offers.get(b.variantId) ?? []));
  }

  summary(b: VariantBasics, offers: PricedOfferRow[]): ProductSummaryDto {
    const available = offers.filter((o) => o.row.retailerProduct.isAvailable);
    const cheapest = available[0];
    return {
      variantId: b.variantId,
      productId: b.productId,
      name: b.name,
      brand: b.brand,
      sizeLabel: b.sizeLabel,
      imageUrl: b.imageUrl,
      categorySlug: b.categorySlug,
      dietary: b.dietary,
      cheapest: cheapest
        ? {
            retailerId: cheapest.row.retailer.id,
            retailerName: cheapest.row.retailer.name,
            priceCents: Math.round(cheapest.price.perItemCents),
            regularPriceCents: cheapest.row.offer.regularPriceCents,
            isPromotion: cheapest.price.appliedPromotion !== null,
            unitPrice: unitPriceDto(cheapest.price.unitPrice),
          }
        : null,
      retailerCount: new Set(available.map((o) => o.row.retailer.id)).size,
      dataOrigin: cheapest?.row.dataOrigin ?? b.dataOrigin,
    };
  }
}

// ─── Lifecycle helper for closable resources ────────────────────────────────

@Injectable()
export class ShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger('Shutdown');
  private readonly closers: (() => Promise<unknown>)[] = [];
  register(closer: () => Promise<unknown>): void {
    this.closers.push(closer);
  }
  async onModuleDestroy(): Promise<void> {
    for (const close of this.closers.reverse()) {
      try {
        await close();
      } catch (error) {
        this.logger.warn(String(error));
      }
    }
  }
}
