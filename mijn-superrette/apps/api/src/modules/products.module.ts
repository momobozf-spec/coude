import { Controller, Get, Inject, Injectable, Module, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { and, asc, eq, gte, inArray, ne } from 'drizzle-orm';
import {
  favorites,
  priceAlerts,
  priceObservations,
  productBarcodes,
  productEquivalences,
  productVariants,
  retailerProducts,
  retailers,
  type Database,
} from '@superrette/database';
import type { DataOrigin } from '@superrette/domain';
import { isHistoricalLow, summarizePriceHistory, type PricePoint } from '@superrette/pricing-engine';
import { normalizeGtin } from '@superrette/shared';
import type { OpenFoodFactsClient } from '@superrette/store-providers';
import {
  historyQuerySchema,
  type BarcodeLookupDto,
  type EquivalentDto,
  type PriceAlertDto,
  type PriceHistoryDto,
  type ProductDetailDto,
} from '@superrette/validation';
import { CurrentUser, OptionalUser, Public, type AuthUser } from '../common/auth.js';
import {
  CatalogService,
  EntitlementsService,
  offerDto,
  ShopperContextService,
  type ShopperContext,
} from '../common/core.services.js';
import { OFF_CLIENT } from '../common/core.module.js';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  async retailersInScope(shopper: ShopperContext, scope: 'mine' | 'all'): Promise<string[] | undefined> {
    return scope === 'all' ? undefined : shopper.retailerIds;
  }

  async detail(variantId: string, shopper: ShopperContext, scope: 'mine' | 'all' = 'mine'): Promise<ProductDetailDto> {
    const basics = (await this.catalog.basics([variantId])).get(variantId);
    if (!basics) throw notFound('Product');
    const retailerIds = await this.retailersInScope(shopper, scope);
    const offers =
      (
        await this.catalog.pricedOffers(
          [variantId],
          shopper,
          retailerIds ? { retailerIds } : { retailerIds: await this.allRetailerIds() },
        )
      ).get(variantId) ?? [];
    const available = offers.filter((o) => o.row.retailerProduct.isAvailable);
    const best = available[0] ? Math.round(available[0].price.perItemCents) : null;
    const offerDtos = offers.map((o) =>
      offerDto(o, o.row.retailerProduct.isAvailable && best !== null && Math.round(o.price.perItemCents) === best),
    );
    const siblings = await this.db
      .select({
        variantId: productVariants.id,
        sizeLabel: productVariants.sizeLabel,
        name: productVariants.displayName,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, basics.productId),
          ne(productVariants.id, variantId),
          inArray(productVariants.dataOrigin, this.catalog.origins),
        ),
      )
      .orderBy(asc(productVariants.netContentAmount));
    let isFavorite = false;
    let alerts: PriceAlertDto[] = [];
    if (shopper.userId) {
      const [fav] = await this.db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, shopper.userId), eq(favorites.variantId, variantId)));
      isFavorite = Boolean(fav);
      const rows = await this.db
        .select({ a: priceAlerts, retailerName: retailers.name })
        .from(priceAlerts)
        .leftJoin(retailers, eq(retailers.id, priceAlerts.retailerId))
        .where(and(eq(priceAlerts.userId, shopper.userId), eq(priceAlerts.variantId, variantId)));
      alerts = rows.map(({ a, retailerName }) => ({
        id: a.id,
        variantId: a.variantId,
        productName: basics.name,
        retailerId: a.retailerId,
        retailerName,
        targetPriceCents: a.targetPriceCents,
        promotionOnly: a.promotionOnly,
        enabled: a.enabled,
        lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
        lastTriggeredPriceCents: a.lastTriggeredPriceCents,
        currentBestPriceCents: best,
      }));
    }
    const cheapestDto = offerDtos.find((o) => o.isCheapest) ?? null;
    return {
      variantId,
      productId: basics.productId,
      name: basics.name,
      brand: basics.brand,
      isPrivateLabel: basics.isPrivateLabel,
      sizeLabel: basics.sizeLabel,
      netContent:
        basics.netAmount != null && basics.netUnit ? { amount: basics.netAmount, unit: basics.netUnit } : null,
      imageUrl: basics.imageUrl,
      category: basics.categorySlug
        ? { slug: basics.categorySlug, name: basics.categoryName?.[shopper.locale] ?? basics.categorySlug }
        : null,
      dietary: basics.dietary,
      gtins: await this.catalog.gtins(variantId),
      offers: offerDtos,
      cheapest: cheapestDto,
      otherSizes: siblings,
      isFavorite,
      alerts,
      dataOrigins: [...new Set(offers.map((o) => o.row.dataOrigin))],
    };
  }

  private async allRetailerIds(): Promise<string[]> {
    const rows = await this.db.select({ id: retailers.id }).from(retailers).where(eq(retailers.isActive, true));
    return rows.map((r) => r.id);
  }

  async history(
    variantId: string,
    shopper: ShopperContext,
    days: number,
    retailerId?: string,
  ): Promise<PriceHistoryDto> {
    const now = new Date();
    const since = new Date(now.getTime() - (days + 7) * 86_400_000);
    const rows = await this.db
      .select({
        retailerId: retailers.id,
        retailerName: retailers.name,
        observedAt: priceObservations.observedAt,
        regular: priceObservations.regularPriceCents,
        promo: priceObservations.promoPriceCents,
        dataOrigin: priceObservations.dataOrigin,
      })
      .from(priceObservations)
      .innerJoin(retailerProducts, eq(retailerProducts.id, priceObservations.retailerProductId))
      .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
      .where(
        and(
          eq(retailerProducts.variantId, variantId),
          gte(priceObservations.observedAt, since),
          inArray(priceObservations.dataOrigin, this.catalog.origins),
          inArray(retailers.id, shopper.retailerIds),
        ),
      )
      .orderBy(asc(priceObservations.observedAt));

    const byRetailer = new Map<string, { name: string; points: PricePoint[] }>();
    for (const r of rows) {
      const entry = byRetailer.get(r.retailerId) ?? { name: r.retailerName, points: [] };
      entry.points.push({ observedAt: r.observedAt, regularPriceCents: r.regular, promoPriceCents: r.promo });
      byRetailer.set(r.retailerId, entry);
    }
    const summaries = [...byRetailer.entries()].map(([id, e]) => ({
      id,
      name: e.name,
      summary: summarizePriceHistory(e.points, { now, windowDays: days }),
    }));
    // Summarise the requested retailer, or the one that is currently cheapest.
    const chosen =
      summaries.find((s) => s.id === retailerId) ??
      summaries
        .filter((s) => s.summary.current)
        .sort((a, b) => a.summary.current!.cents - b.summary.current!.cents)[0] ??
      summaries[0];
    const s = chosen?.summary;
    return {
      variantId,
      windowDays: days,
      current: s?.current
        ? { cents: s.current.cents, isPromo: s.current.isPromo, observedAt: s.current.observedAt.toISOString() }
        : null,
      lowest: s?.lowest ? { cents: s.lowest.cents, observedAt: s.lowest.observedAt.toISOString() } : null,
      highest: s?.highest ? { cents: s.highest.cents, observedAt: s.highest.observedAt.toISOString() } : null,
      averageCents: s?.averageCents ?? null,
      observationCount: s?.observationCount ?? 0,
      coverage: s?.coverage ?? 0,
      isComplete: s?.isComplete ?? false,
      isHistoricalLow: s ? isHistoricalLow(s) : false,
      series: summaries.map((x) => ({ retailerId: x.id, retailerName: x.name, points: x.summary.daily })),
      dataOrigins: [...new Set(rows.map((r) => r.dataOrigin))] as DataOrigin[],
    };
  }

  async equivalents(variantId: string, shopper: ShopperContext): Promise<EquivalentDto[]> {
    const rows = await this.db
      .select({
        target: productEquivalences.targetVariantId,
        confidence: productEquivalences.confidence,
        status: productEquivalences.status,
      })
      .from(productEquivalences)
      .where(and(eq(productEquivalences.sourceVariantId, variantId), ne(productEquivalences.status, 'REJECTED')));
    const ids = rows.map((r) => r.target);
    const [basics, offers] = await Promise.all([this.catalog.basics(ids), this.catalog.pricedOffers(ids, shopper)]);
    return rows
      .filter((r) => basics.has(r.target))
      .map((r) => {
        const b = basics.get(r.target)!;
        const cheapest = (offers.get(r.target) ?? [])[0];
        return {
          variantId: r.target,
          name: b.name,
          brand: b.brand,
          sizeLabel: b.sizeLabel,
          matchType: 'EQUIVALENT' as const,
          confidence: r.status === 'CONFIRMED' ? Math.max(r.confidence, 0.95) : r.confidence,
          status: r.status,
          cheapestPriceCents: cheapest ? Math.round(cheapest.price.perItemCents) : null,
        };
      })
      .sort((a, b) => b.confidence - a.confidence || (a.cheapestPriceCents ?? 1e9) - (b.cheapestPriceCents ?? 1e9));
  }

  async variantForGtin(gtin: string): Promise<string | null> {
    const [row] = await this.db
      .select({ variantId: productBarcodes.variantId })
      .from(productBarcodes)
      .where(eq(productBarcodes.gtin, gtin));
    return row?.variantId ?? null;
  }
}

@Controller('v1')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly shoppers: ShopperContextService,
    private readonly entitlements: EntitlementsService,
    @Inject(OFF_CLIENT) private readonly off: OpenFoodFactsClient | null,
  ) {}

  @Public()
  @Get('products/:variantId')
  async detail(
    @Param('variantId', ParseUUIDPipe) id: string,
    @OptionalUser() user: AuthUser | null,
    @Query('scope') scope?: string,
  ): Promise<ProductDetailDto> {
    return this.products.detail(id, await this.shoppers.get(user?.id ?? null), scope === 'all' ? 'all' : 'mine');
  }

  @Get('products/:variantId/history')
  async history(
    @Param('variantId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(historyQuerySchema)) query: { days: number },
    @Query('retailerId') retailerId?: string,
  ): Promise<PriceHistoryDto> {
    await this.entitlements.require(user.id, 'price_history');
    return this.products.history(id, await this.shoppers.get(user.id), query.days, retailerId);
  }

  @Public()
  @Get('products/:variantId/equivalents')
  async equivalents(
    @Param('variantId', ParseUUIDPipe) id: string,
    @OptionalUser() user: AuthUser | null,
  ): Promise<EquivalentDto[]> {
    return this.products.equivalents(id, await this.shoppers.get(user?.id ?? null));
  }

  /** Barcode scan: never invents a product for an unknown code. */
  @Public()
  @Get('barcodes/:code')
  async barcode(@Param('code') code: string, @OptionalUser() user: AuthUser | null): Promise<BarcodeLookupDto> {
    const gtin = normalizeGtin(code);
    if (!gtin) return { gtin: code, status: 'INVALID', product: null, external: null };
    const variantId = await this.products.variantForGtin(gtin);
    if (variantId) {
      return {
        gtin,
        status: 'FOUND',
        product: await this.products.detail(variantId, await this.shoppers.get(user?.id ?? null)),
        external: null,
      };
    }
    const meta = this.off ? await this.off.lookup(gtin) : null;
    return {
      gtin,
      status: 'UNKNOWN',
      product: null,
      external: meta
        ? {
            source: 'open-food-facts',
            name: meta.name,
            brand: meta.brand,
            quantity: meta.quantity,
            imageUrl: meta.imageUrl,
          }
        : null,
    };
  }
}

@Module({ controllers: [ProductsController], providers: [ProductsService], exports: [ProductsService] })
export class ProductsModule {}
