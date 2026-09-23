import { type BaseQuantity, type Cents, discountPercent } from '@superrette/shared';
import type { PromotionMechanic } from '@superrette/domain';
import {
  DEFAULT_CONDITIONS,
  PromotionCalculator,
  type PricingContext,
  type PricingPromotion,
  type PromotionIneligibility,
} from './promotion-calculator.js';
import { UnitPriceCalculator, type UnitPrice } from './unit-price.js';

/** A retailer's offer for one product, as needed for price calculation. */
export interface PricedOffer {
  retailerId: string;
  retailerProductId: string;
  regularPriceCents: Cents;
  /** Shelf promo price from the latest observation (implicit price cut). */
  shelfPromoPriceCents?: Cents | null;
  promotions: readonly PricingPromotion[];
  netContent: BaseQuantity | null;
}

export interface AppliedPromotion {
  id: string;
  label: string;
  mechanic: PromotionMechanic;
}

export interface MissedPromotion extends AppliedPromotion {
  reason: PromotionIneligibility;
  /** What the purchase would cost if the shopper met the condition (e.g. had the card). */
  potentialTotalCents: Cents | null;
  minimumBeneficialQuantity: number;
}

export interface EffectivePrice {
  retailerId: string;
  retailerProductId: string;
  quantity: number;
  regularTotalCents: Cents;
  totalCents: Cents;
  /** Average price per unit at this quantity (may be fractional). */
  perItemCents: number;
  savingsCents: Cents;
  discountPercent: number;
  appliedPromotion: AppliedPromotion | null;
  missedPromotions: MissedPromotion[];
  /** Unit price (€/kg, €/l, €/piece) based on the effective per-item price. */
  unitPrice: UnitPrice | null;
  regularUnitPrice: UnitPrice | null;
}

export interface Discount {
  amountCents: Cents;
  percent: number;
}

export type CompareBy = 'total' | 'unitPrice';

export interface PriceComparison {
  ranked: EffectivePrice[];
  cheapest: EffectivePrice | null;
  /** Retailer ids tied for cheapest. */
  cheapestRetailerIds: string[];
  /** Difference between most and least expensive, in cents. */
  spreadCents: Cents;
}

const SHELF_PROMO_ID = 'shelf-promo';

function implicitShelfPromotion(offer: PricedOffer): PricingPromotion | null {
  const promo = offer.shelfPromoPriceCents;
  if (promo == null || promo >= offer.regularPriceCents) return null;
  return {
    id: SHELF_PROMO_ID,
    label: 'Promo',
    params: { mechanic: 'PRICE_CUT', promoPriceCents: promo },
    startsAt: null,
    endsAt: null,
    conditions: DEFAULT_CONDITIONS,
  };
}

function describe(p: PricingPromotion): AppliedPromotion {
  return { id: p.id, label: p.label, mechanic: p.params.mechanic };
}

/**
 * PricingEngine combines unit pricing and promotion mechanics. Promotions do
 * not stack: the engine applies the single best eligible promotion, which is
 * how BE/NL supermarkets settle competing offers at the till.
 */
export const PricingEngine = {
  calculateUnitPrice(priceCents: Cents, netContent: BaseQuantity | null): UnitPrice | null {
    return UnitPriceCalculator.calculate(priceCents, netContent);
  },

  calculateDiscount(regularCents: Cents, effectiveCents: Cents): Discount {
    const amountCents = Math.max(0, regularCents - effectiveCents);
    return { amountCents, percent: discountPercent(regularCents, effectiveCents) };
  },

  calculateEffectivePrice(offer: PricedOffer, quantity: number, context: PricingContext): EffectivePrice {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError(`quantity must be a positive integer, got ${quantity}`);
    }
    const regularTotalCents = offer.regularPriceCents * quantity;
    const candidates: PricingPromotion[] = [...offer.promotions];
    const shelf = implicitShelfPromotion(offer);
    if (shelf) candidates.push(shelf);

    let best: { promotion: PricingPromotion; totalCents: Cents } | null = null;
    const missed: MissedPromotion[] = [];

    for (const promotion of candidates) {
      const reason = PromotionCalculator.ineligibility(promotion, quantity, context);
      if (reason === 'NOT_ACTIVE') continue;
      if (reason) {
        const minQty = Math.max(quantity, promotion.conditions.minQuantity ?? 1);
        const potential = PromotionCalculator.apply(promotion, offer.regularPriceCents, minQty);
        missed.push({
          ...describe(promotion),
          reason,
          potentialTotalCents:
            reason === 'QUANTITY_TOO_LOW' || potential.totalCents >= offer.regularPriceCents * minQty
              ? null
              : potential.totalCents,
          minimumBeneficialQuantity: potential.minimumBeneficialQuantity,
        });
        continue;
      }
      const application = PromotionCalculator.apply(promotion, offer.regularPriceCents, quantity);
      if (application.totalCents >= regularTotalCents) {
        // e.g. "2 voor €5" while buying a single unit: eligible but no benefit yet.
        missed.push({
          ...describe(promotion),
          reason: 'NO_BENEFIT_AT_QUANTITY',
          potentialTotalCents: null,
          minimumBeneficialQuantity: application.minimumBeneficialQuantity,
        });
        continue;
      }
      if (!best || application.totalCents < best.totalCents) {
        best = { promotion, totalCents: application.totalCents };
      }
    }

    const totalCents = best?.totalCents ?? regularTotalCents;
    const perItemCents = totalCents / quantity;
    const discount = this.calculateDiscount(regularTotalCents, totalCents);
    const effectiveUnit = UnitPriceCalculator.calculate(perItemCents, offer.netContent);
    return {
      retailerId: offer.retailerId,
      retailerProductId: offer.retailerProductId,
      quantity,
      regularTotalCents,
      totalCents,
      perItemCents,
      savingsCents: discount.amountCents,
      discountPercent: discount.percent,
      appliedPromotion: best ? describe(best.promotion) : null,
      missedPromotions: missed,
      unitPrice: effectiveUnit,
      regularUnitPrice: UnitPriceCalculator.calculate(offer.regularPriceCents, offer.netContent),
    };
  },

  comparePrices(
    offers: readonly PricedOffer[],
    quantity: number,
    context: PricingContext,
    by: CompareBy = 'total',
  ): PriceComparison {
    const priced = offers.map((o) => this.calculateEffectivePrice(o, quantity, context));
    const key = (p: EffectivePrice): number =>
      by === 'unitPrice' ? (p.unitPrice?.exactCents ?? Number.POSITIVE_INFINITY) : p.totalCents;
    const ranked = [...priced].sort((a, b) => key(a) - key(b) || a.retailerId.localeCompare(b.retailerId));
    const cheapest = ranked[0] ?? null;
    const cheapestRetailerIds = cheapest ? ranked.filter((p) => key(p) === key(cheapest)).map((p) => p.retailerId) : [];
    const last = ranked[ranked.length - 1];
    return {
      ranked,
      cheapest,
      cheapestRetailerIds,
      spreadCents: cheapest && last ? last.totalCents - cheapest.totalCents : 0,
    };
  },

  findCheapestRetailer(
    offers: readonly PricedOffer[],
    quantity: number,
    context: PricingContext,
    by: CompareBy = 'total',
  ): EffectivePrice | null {
    return this.comparePrices(offers, quantity, context, by).cheapest;
  },
};
