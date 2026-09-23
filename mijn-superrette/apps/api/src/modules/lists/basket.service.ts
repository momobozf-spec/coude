import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { loadOffers, productEquivalences, retailers, shoppingListItems, type Database } from '@superrette/database';
import {
  BasketComparisonEngine,
  SmartBasketOptimizer,
  type BasketCandidate,
  type BasketComparison,
  type BasketLineChoice,
  type SmartPlan,
} from '@superrette/basket-engine';
import type {
  BasketChoiceDto,
  BasketComparisonDto,
  SmartBasketDto,
  SmartBasketInput,
  SmartPlanDto,
} from '@superrette/validation';
import { CatalogService, EntitlementsService, ShopperContextService, unitPriceDto } from '../../common/core.services.js';
import { DB } from '../../common/tokens.js';
import { SearchService } from '../search.module.js';
import { ListsService } from './lists.service.js';

type ItemRow = typeof shoppingListItems.$inferSelect;

interface ItemCandidateVariant {
  variantId: string;
  matchType: 'EXACT' | 'EQUIVALENT' | 'GENERIC';
  confidence: number;
}

const choiceDto = (c: BasketLineChoice): BasketChoiceDto => ({
  variantId: c.productId,
  retailerProductId: c.retailerProductId,
  name: c.productName,
  brand: c.brandName,
  matchType: c.matchType,
  confidence: c.confidence,
  totalCents: c.price.totalCents,
  regularTotalCents: c.price.regularTotalCents,
  perItemCents: Math.round(c.price.perItemCents),
  unitPrice: unitPriceDto(c.price.unitPrice),
  promotionLabel: c.price.appliedPromotion?.label ?? null,
});

/**
 * Connects shopping lists to the BasketComparisonEngine:
 *  - exact items (preferred product) → EXACT + stored/suggested equivalents
 *  - free-text items ("melk") → GENERIC candidates from search, with a
 *    confidence derived from how well the product matches the text
 *  - the user's "Wijzig product" choices → USER_SELECTED
 */
@Injectable()
export class BasketService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly lists: ListsService,
    private readonly search: SearchService,
    private readonly catalog: CatalogService,
    private readonly shoppers: ShopperContextService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async candidateVariants(item: ItemRow): Promise<ItemCandidateVariant[]> {
    if (item.preferredVariantId) {
      const eq2 = await this.db
        .select({ target: productEquivalences.targetVariantId, confidence: productEquivalences.confidence, status: productEquivalences.status })
        .from(productEquivalences)
        .where(and(eq(productEquivalences.sourceVariantId, item.preferredVariantId), ne(productEquivalences.status, 'REJECTED')));
      return [
        { variantId: item.preferredVariantId, matchType: 'EXACT', confidence: 1 },
        ...eq2.map((e) => ({ variantId: e.target, matchType: 'EQUIVALENT' as const, confidence: e.status === 'CONFIRMED' ? Math.max(0.95, e.confidence) : e.confidence })),
      ];
    }
    const { ranked } = await this.search.rank(item.title, 40);
    const basics = item.preferredBrand ? await this.catalog.basics(ranked.map((r) => r.variantId)) : null;
    return ranked.map((r) => {
      let confidence = Math.min(0.95, 0.45 + 0.45 * r.tokenRatio + 0.15 * r.similarity);
      if (basics && item.preferredBrand) {
        const brand = basics.get(r.variantId)?.brand?.toLowerCase();
        confidence = brand === item.preferredBrand.toLowerCase() ? Math.min(1, confidence + 0.05) : confidence - 0.1;
      }
      return { variantId: r.variantId, matchType: 'GENERIC' as const, confidence: Math.round(confidence * 100) / 100 };
    });
  }

  async compute(listId: string, userId: string, requestedRetailerIds?: string[]): Promise<{ comparison: BasketComparison; dto: BasketComparisonDto }> {
    await this.lists.requireRole(listId, userId, 'VIEWER');
    const shopper = await this.shoppers.get(userId);
    const limit = await this.entitlements.limit(userId, 'basket_comparison');
    if (limit === 0) await this.entitlements.require(userId, 'basket_comparison');
    let retailerIds = requestedRetailerIds?.length ? requestedRetailerIds : shopper.retailerIds;
    const retailerLimit = limit;
    if (limit !== null && retailerIds.length > limit) retailerIds = retailerIds.slice(0, limit);

    // Checked items stay in the comparison: ticking off while shopping must not change totals.
    const items = await this.db.select().from(shoppingListItems).where(eq(shoppingListItems.listId, listId)).orderBy(asc(shoppingListItems.position));
    const retailerRows = await this.db.select({ id: retailers.id, name: retailers.name, brandColor: retailers.brandColor }).from(retailers).where(inArray(retailers.id, retailerIds));

    const perItem = new Map<string, ItemCandidateVariant[]>();
    for (const item of items) perItem.set(item.id, await this.candidateVariants(item));
    const allVariantIds = [...new Set([...perItem.values()].flat().map((c) => c.variantId))];
    const now = new Date();
    const [offers, basics] = await Promise.all([
      loadOffers(this.db, { variantIds: allVariantIds, retailerIds, at: now, origins: this.catalog.origins }),
      this.catalog.basics(allVariantIds),
    ]);

    const candidates: BasketCandidate[] = [];
    for (const item of items) {
      for (const c of perItem.get(item.id) ?? []) {
        for (const o of offers) {
          if (o.variantId !== c.variantId || !o.retailerProduct.isAvailable) continue;
          const b = basics.get(c.variantId);
          candidates.push({
            itemId: item.id,
            retailerId: o.retailer.id,
            productId: c.variantId,
            retailerProductId: o.retailerProduct.id,
            productName: b?.name ?? o.retailerProduct.title,
            brandName: b?.brand ?? null,
            matchType: c.matchType,
            confidence: c.confidence,
            offer: o.offer,
          });
        }
      }
    }
    // An exact product also found as another item's equivalent must not be counted twice.
    const unique = new Map<string, BasketCandidate>();
    for (const c of candidates) {
      const key = `${c.itemId}:${c.retailerProductId}`;
      const prev = unique.get(key);
      if (!prev || c.confidence > prev.confidence) unique.set(key, c);
    }

    const comparison = BasketComparisonEngine.compare({
      items: items.map((i) => ({ id: i.id, title: i.title, quantity: i.quantity })),
      retailers: retailerRows.map((r) => ({ id: r.id, name: r.name })),
      candidates: [...unique.values()],
      selections: await this.lists.selections(listId),
      context: shopper.pricing(now),
    });
    const color = new Map(retailerRows.map((r) => [r.id, r.brandColor]));
    const dto: BasketComparisonDto = {
      listId,
      itemCount: comparison.itemCount,
      cheapestCompleteRetailerId: comparison.cheapestCompleteRetailerId,
      retailerLimit,
      retailers: comparison.retailers.map((r) => ({
        retailer: { id: r.retailerId, name: r.retailerName, brandColor: color.get(r.retailerId) ?? '#666666' },
        totalCents: r.totalCents,
        regularTotalCents: r.regularTotalCents,
        savingsCents: r.savingsCents,
        foundCount: r.foundCount,
        itemCount: r.itemCount,
        isComplete: r.isComplete,
        exactCount: r.exactCount,
        equivalentCount: r.equivalentCount,
        averageConfidence: r.averageConfidence,
        lines: r.lines.map((l) => ({
          itemId: l.itemId,
          title: l.title,
          quantity: l.quantity,
          status: l.status,
          confidence: l.confidence,
          selected: l.selected ? choiceDto(l.selected) : null,
          alternatives: l.alternatives.map(choiceDto),
        })),
      })),
      dataOrigins: [...new Set(offers.map((o) => o.dataOrigin))],
      computedAt: now.toISOString(),
    };
    return { comparison, dto };
  }

  async compare(listId: string, userId: string, retailerIds?: string[]): Promise<BasketComparisonDto> {
    return (await this.compute(listId, userId, retailerIds)).dto;
  }

  async smart(listId: string, userId: string, input: SmartBasketInput): Promise<SmartBasketDto> {
    await this.entitlements.require(userId, 'smart_basket');
    const { comparison } = await this.compute(listId, userId, input.retailerIds);
    const names = new Map(comparison.retailers.map((r) => [r.retailerId, r.retailerName]));
    const result = SmartBasketOptimizer.optimize(comparison, {
      maxStores: input.maxStores,
      ...(input.extraStoreCostCents != null ? { extraStoreCostCents: input.extraStoreCostCents } : {}),
      ...(input.minSavingsCents != null ? { minSavingsCents: input.minSavingsCents } : {}),
    });
    const plan = (p: SmartPlan | null): SmartPlanDto | null =>
      p && {
        retailers: p.perRetailer.map((r) => ({ id: r.retailerId, name: names.get(r.retailerId) ?? '', subtotalCents: r.subtotalCents, itemIds: r.itemIds })),
        totalCents: p.totalCents,
        adjustedTotalCents: p.adjustedTotalCents,
        foundCount: p.foundCount,
        missingItemIds: p.missingItemIds,
      };
    return {
      listId,
      maxStores: input.maxStores,
      singleStore: result.singleStore.map((p) => plan(p)!),
      best: plan(result.best),
      bestSingleStore: plan(result.bestSingleStore),
      savingsCents: result.savingsCents,
      recommendCombining: result.recommendCombining,
    };
  }
}
