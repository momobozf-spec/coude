import { Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { favorites, priceAlerts, priceObservations, productVariants, type Database } from '@superrette/database';
import { summarizePriceHistory, isHistoricalLow, type PricePoint } from '@superrette/pricing-engine';
import type { FavoriteDto, FavoriteInsightDto } from '@superrette/validation';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { CatalogService, ShopperContextService, type ShopperContext } from '../common/core.services.js';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Favourites with insights for Home: in promotion, price dropped since the
   * previous observation, historical low (90 days) and recently triggered alerts.
   */
  async list(shopper: ShopperContext, limit = 50): Promise<FavoriteDto[]> {
    const userId = shopper.userId!;
    const favs = await this.db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt)).limit(limit);
    if (favs.length === 0) return [];
    const ids = favs.map((f) => f.variantId);
    const [basics, offers, alerts] = await Promise.all([
      this.catalog.basics(ids),
      this.catalog.pricedOffers(ids, shopper),
      this.db.select().from(priceAlerts).where(and(eq(priceAlerts.userId, userId), inArray(priceAlerts.variantId, ids))),
    ]);
    const cheapestRpIds = [...offers.values()].map((o) => o[0]?.row.retailerProduct.id).filter((x): x is string => Boolean(x));
    const since = new Date(Date.now() - 97 * 86_400_000);
    const history = cheapestRpIds.length
      ? await this.db
          .select({ rp: priceObservations.retailerProductId, observedAt: priceObservations.observedAt, regular: priceObservations.regularPriceCents, promo: priceObservations.promoPriceCents })
          .from(priceObservations)
          .where(and(inArray(priceObservations.retailerProductId, cheapestRpIds), gte(priceObservations.observedAt, since), inArray(priceObservations.dataOrigin, this.catalog.origins)))
      : [];
    const pointsByRp = new Map<string, PricePoint[]>();
    for (const h of history) {
      const list = pointsByRp.get(h.rp) ?? [];
      list.push({ observedAt: h.observedAt, regularPriceCents: h.regular, promoPriceCents: h.promo });
      pointsByRp.set(h.rp, list);
    }

    const result: FavoriteDto[] = [];
    for (const fav of favs) {
      const b = basics.get(fav.variantId);
      if (!b) continue;
      const o = offers.get(fav.variantId) ?? [];
      const summary = this.catalog.summary(b, o);
      const insights: FavoriteInsightDto[] = [];
      const cheapest = o[0];
      if (cheapest?.price.appliedPromotion) {
        insights.push({ kind: 'DISCOUNTED', previousPriceCents: cheapest.row.offer.regularPriceCents, discountPercent: cheapest.price.discountPercent });
      }
      const points = cheapest ? (pointsByRp.get(cheapest.row.retailerProduct.id) ?? []).sort((a, c) => a.observedAt.getTime() - c.observedAt.getTime()) : [];
      if (points.length >= 2 && cheapest) {
        const eff = (p: PricePoint): number => (p.promoPriceCents != null && p.promoPriceCents < p.regularPriceCents ? p.promoPriceCents : p.regularPriceCents);
        const prev = eff(points[points.length - 2]!);
        const now = Math.round(cheapest.price.perItemCents);
        if (now < prev && !insights.some((i) => i.kind === 'DISCOUNTED')) {
          insights.push({ kind: 'PRICE_DROP', previousPriceCents: prev, discountPercent: Math.round(((prev - now) / prev) * 1000) / 10 });
        }
        if (isHistoricalLow(summarizePriceHistory(points, { now: new Date(), windowDays: 90 }))) {
          insights.push({ kind: 'HISTORICAL_LOW', previousPriceCents: null, discountPercent: null });
        }
      }
      const recentAlert = alerts.find((a) => a.variantId === fav.variantId && a.lastTriggeredAt && Date.now() - a.lastTriggeredAt.getTime() < 7 * 86_400_000);
      if (recentAlert) insights.push({ kind: 'ALERT_TRIGGERED', previousPriceCents: null, discountPercent: null });
      result.push({ product: summary, insights, createdAt: fav.createdAt.toISOString() });
    }
    return result;
  }

  async add(userId: string, variantId: string): Promise<void> {
    const [v] = await this.db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, variantId));
    if (!v) throw notFound('Product');
    await this.db.insert(favorites).values({ userId, variantId }).onConflictDoNothing();
  }

  async remove(userId: string, variantId: string): Promise<void> {
    await this.db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.variantId, variantId)));
  }
}

@Controller('v1/favorites')
export class FavoritesController {
  constructor(
    private readonly favorites: FavoritesService,
    private readonly shoppers: ShopperContextService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<FavoriteDto[]> {
    return this.favorites.list(await this.shoppers.get(user.id));
  }

  @Put(':variantId')
  @HttpCode(204)
  async add(@CurrentUser() user: AuthUser, @Param('variantId', ParseUUIDPipe) variantId: string): Promise<void> {
    await this.favorites.add(user.id, variantId);
  }

  @Delete(':variantId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('variantId', ParseUUIDPipe) variantId: string): Promise<void> {
    await this.favorites.remove(user.id, variantId);
  }
}

@Module({ controllers: [FavoritesController], providers: [FavoritesService], exports: [FavoritesService] })
export class FavoritesModule {}
