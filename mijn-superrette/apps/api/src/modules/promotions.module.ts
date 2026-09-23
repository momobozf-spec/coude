import { Controller, Get, Inject, Injectable, Module, Query } from '@nestjs/common';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  brands,
  categories,
  currentPrices,
  favorites,
  products,
  productVariants,
  promotionConditions,
  promotionProducts,
  promotions,
  retailerProducts,
  retailers,
  type Database,
} from '@superrette/database';
import { DEFAULT_CONDITIONS, PromotionCalculator } from '@superrette/pricing-engine';
import { discountPercent } from '@superrette/shared';
import { promotionsQuerySchema, type PromotionDto, type PromotionsQuery } from '@superrette/validation';
import { OptionalUser, Public, type AuthUser } from '../common/auth.js';
import { CatalogService, ShopperContextService, type ShopperContext } from '../common/core.services.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

@Injectable()
export class PromotionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  async list(q: PromotionsQuery, shopper: ShopperContext): Promise<PromotionDto[]> {
    const now = new Date();
    const retailerIds = q.section === 'retailer' && q.retailerId ? [q.retailerId] : shopper.retailerIds;
    if (retailerIds.length === 0) return [];
    const rows = await this.db
      .select({
        p: promotions,
        c: promotionConditions,
        retailerName: retailers.name,
        brandColor: retailers.brandColor,
        rpId: retailerProducts.id,
        rpTitle: retailerProducts.title,
        variantId: retailerProducts.variantId,
        variantName: productVariants.displayName,
        sizeLabel: productVariants.sizeLabel,
        brand: brands.name,
        categorySlug: categories.slug,
        regular: currentPrices.regularPriceCents,
      })
      .from(promotions)
      .innerJoin(retailers, eq(retailers.id, promotions.retailerId))
      .leftJoin(promotionConditions, eq(promotionConditions.promotionId, promotions.id))
      .innerJoin(promotionProducts, eq(promotionProducts.promotionId, promotions.id))
      .innerJoin(retailerProducts, eq(retailerProducts.id, promotionProducts.retailerProductId))
      .innerJoin(currentPrices, eq(currentPrices.retailerProductId, retailerProducts.id))
      .leftJoin(productVariants, eq(productVariants.id, retailerProducts.variantId))
      .leftJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(
          inArray(promotions.retailerId, retailerIds),
          inArray(promotions.dataOrigin, this.catalog.origins),
          or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
          or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
        ),
      );

    const favoriteIds = shopper.userId
      ? new Set(
          (
            await this.db.select({ v: favorites.variantId }).from(favorites).where(eq(favorites.userId, shopper.userId))
          ).map((f) => f.v),
        )
      : new Set<string>();

    let items: PromotionDto[] = rows.map((r) => {
      const conditions = r.c ? { ...r.c, regionCodes: r.c.regionCodes } : DEFAULT_CONDITIONS;
      const promo = {
        id: r.p.id,
        label: r.p.label,
        params: r.p.params,
        startsAt: r.p.startsAt,
        endsAt: r.p.endsAt,
        conditions,
      };
      const qty = Math.max(PromotionCalculator.groupSize(r.p.params), conditions.minQuantity ?? 1);
      const total = PromotionCalculator.apply(promo, r.regular, qty).totalCents;
      const perItem = Math.round(total / qty);
      return {
        id: r.p.id,
        label: r.p.label,
        description: r.p.description,
        mechanic: r.p.mechanic,
        params: r.p.params,
        retailer: { id: r.p.retailerId, name: r.retailerName, brandColor: r.brandColor },
        variantId: r.variantId,
        productName: r.variantName ?? r.rpTitle,
        brand: r.brand,
        sizeLabel: r.sizeLabel,
        regularPriceCents: r.regular,
        promoPerItemCents: perItem,
        minimumQuantity: qty,
        discountPercent: discountPercent(r.regular * qty, total),
        startsAt: r.p.startsAt?.toISOString() ?? null,
        endsAt: r.p.endsAt?.toISOString() ?? null,
        loyaltyProgram: conditions.loyaltyCardRequired ? conditions.loyaltyProgram : null,
        categorySlug: r.categorySlug,
        isFavorite: r.variantId ? favoriteIds.has(r.variantId) : false,
        dataOrigin: r.p.dataOrigin,
      };
    });

    if (q.section === 'favorites') items = items.filter((i) => i.isFavorite);
    if (q.section === 'category' && q.category) items = items.filter((i) => i.categorySlug === q.category);
    if (q.section === 'ending_soon')
      items = items.filter((i) => i.endsAt && new Date(i.endsAt).getTime() - now.getTime() < 3 * 86_400_000);

    const endsAt = (i: PromotionDto): number => (i.endsAt ? new Date(i.endsAt).getTime() : Number.POSITIVE_INFINITY);
    switch (q.sort) {
      case 'lowest_price':
        items.sort((a, b) => a.promoPerItemCents - b.promoPerItemCents);
        break;
      case 'ending_soon':
        items.sort((a, b) => endsAt(a) - endsAt(b));
        break;
      case 'recent':
        items.sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
        break;
      default:
        items.sort((a, b) => b.discountPercent - a.discountPercent);
    }
    if (q.section === 'for_you') items.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
    return items.slice(0, q.limit);
  }
}

@Controller('v1/promotions')
export class PromotionsController {
  constructor(
    private readonly promotions: PromotionsService,
    private readonly shoppers: ShopperContextService,
  ) {}

  @Public()
  @Get()
  async list(
    @Query(new ZodPipe(promotionsQuerySchema)) q: PromotionsQuery,
    @OptionalUser() user: AuthUser | null,
  ): Promise<PromotionDto[]> {
    return this.promotions.list(q, await this.shoppers.get(user?.id ?? null));
  }
}

@Module({ controllers: [PromotionsController], providers: [PromotionsService], exports: [PromotionsService] })
export class PromotionsModule {}
