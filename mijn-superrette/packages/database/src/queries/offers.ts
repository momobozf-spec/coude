import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { BaseUnit, Cents } from '@superrette/shared';
import type { DataOrigin } from '@superrette/domain';
import type { PricedOffer, PricingPromotion } from '@superrette/pricing-engine';
import type { Database } from '../client.js';
import {
  currentPrices,
  productVariants,
  promotionConditions,
  promotionProducts,
  promotions,
  retailerProducts,
  retailers,
} from '../schema/index.js';

export interface OfferRow {
  variantId: string;
  retailer: { id: string; slug: string; name: string; brandColor: string; loyaltyProgram: string | null };
  retailerProduct: { id: string; title: string; sku: string; productUrl: string | null; isAvailable: boolean };
  observedAt: Date;
  dataOrigin: DataOrigin;
  sourceProvider: string;
  promotions: (PricingPromotion & { description: string | null })[];
  offer: PricedOffer;
}

export interface LoadOffersOptions {
  variantIds: readonly string[];
  retailerIds?: readonly string[] | null;
  at: Date;
  /** Data origins allowed in this environment (production excludes DEVELOPMENT_SEED). */
  origins: readonly DataOrigin[];
}

/**
 * Read model used by product detail, basket comparison and alert evaluation:
 * the current price of every retailer product linked to the given variants,
 * together with active promotions in PricingEngine shape.
 */
export async function loadOffers(db: Database, options: LoadOffersOptions): Promise<OfferRow[]> {
  if (options.variantIds.length === 0) return [];
  const filters = [
    inArray(retailerProducts.variantId, [...options.variantIds]),
    eq(retailers.isActive, true),
    inArray(currentPrices.dataOrigin, [...options.origins]),
  ];
  if (options.retailerIds && options.retailerIds.length > 0) {
    filters.push(inArray(retailerProducts.retailerId, [...options.retailerIds]));
  }

  const rows = await db
    .select({
      variantId: retailerProducts.variantId,
      rpId: retailerProducts.id,
      rpTitle: retailerProducts.title,
      rpSku: retailerProducts.retailerSku,
      rpUrl: retailerProducts.productUrl,
      rpAvailable: retailerProducts.isAvailable,
      retailerId: retailers.id,
      retailerSlug: retailers.slug,
      retailerName: retailers.name,
      retailerColor: retailers.brandColor,
      loyaltyProgram: retailers.loyaltyProgram,
      regular: currentPrices.regularPriceCents,
      promo: currentPrices.promoPriceCents,
      observedAt: currentPrices.observedAt,
      dataOrigin: currentPrices.dataOrigin,
      sourceProvider: currentPrices.sourceProvider,
      netAmount: productVariants.netContentAmount,
      netUnit: productVariants.netContentUnit,
    })
    .from(retailerProducts)
    .innerJoin(currentPrices, eq(currentPrices.retailerProductId, retailerProducts.id))
    .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
    .innerJoin(productVariants, eq(productVariants.id, retailerProducts.variantId))
    .where(and(...filters));

  if (rows.length === 0) return [];

  const promoRows = await db
    .select({
      retailerProductId: promotionProducts.retailerProductId,
      id: promotions.id,
      label: promotions.label,
      description: promotions.description,
      params: promotions.params,
      startsAt: promotions.startsAt,
      endsAt: promotions.endsAt,
      loyaltyCardRequired: promotionConditions.loyaltyCardRequired,
      loyaltyProgram: promotionConditions.loyaltyProgram,
      minQuantity: promotionConditions.minQuantity,
      maxQuantityPerCustomer: promotionConditions.maxQuantityPerCustomer,
      onlineOnly: promotionConditions.onlineOnly,
      regionCodes: promotionConditions.regionCodes,
    })
    .from(promotionProducts)
    .innerJoin(promotions, eq(promotions.id, promotionProducts.promotionId))
    .leftJoin(promotionConditions, eq(promotionConditions.promotionId, promotions.id))
    .where(
      and(
        inArray(
          promotionProducts.retailerProductId,
          rows.map((r) => r.rpId),
        ),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, options.at)),
        or(isNull(promotions.endsAt), gte(promotions.endsAt, options.at)),
        inArray(promotions.dataOrigin, [...options.origins]),
      ),
    );

  const promosByRp = new Map<string, OfferRow['promotions']>();
  for (const p of promoRows) {
    const promotion: OfferRow['promotions'][number] = {
      id: p.id,
      label: p.label,
      description: p.description,
      params: p.params,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      conditions: {
        loyaltyCardRequired: p.loyaltyCardRequired ?? false,
        loyaltyProgram: p.loyaltyProgram ?? null,
        minQuantity: p.minQuantity ?? null,
        maxQuantityPerCustomer: p.maxQuantityPerCustomer ?? null,
        onlineOnly: p.onlineOnly ?? false,
        regionCodes: p.regionCodes ?? [],
      },
    };
    const list = promosByRp.get(p.retailerProductId);
    if (list) list.push(promotion);
    else promosByRp.set(p.retailerProductId, [promotion]);
  }

  return rows.map((r) => {
    const promos = promosByRp.get(r.rpId) ?? [];
    const netContent =
      r.netAmount != null && r.netUnit ? { amount: Number(r.netAmount), unit: r.netUnit as BaseUnit } : null;
    return {
      variantId: r.variantId!,
      retailer: {
        id: r.retailerId,
        slug: r.retailerSlug,
        name: r.retailerName,
        brandColor: r.retailerColor,
        loyaltyProgram: r.loyaltyProgram,
      },
      retailerProduct: { id: r.rpId, title: r.rpTitle, sku: r.rpSku, productUrl: r.rpUrl, isAvailable: r.rpAvailable },
      observedAt: r.observedAt,
      dataOrigin: r.dataOrigin,
      sourceProvider: r.sourceProvider,
      promotions: promos,
      offer: {
        retailerId: r.retailerId,
        retailerProductId: r.rpId,
        regularPriceCents: r.regular as Cents,
        shelfPromoPriceCents: r.promo,
        promotions: promos,
        netContent,
      },
    };
  });
}
