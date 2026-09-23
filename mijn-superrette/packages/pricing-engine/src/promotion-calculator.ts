import { type Cents, isWithin, roundHalfUp } from '@superrette/shared';
import type { PromotionCondition, PromotionParams } from '@superrette/domain';

export interface PricingPromotion {
  id: string;
  label: string;
  params: PromotionParams;
  startsAt: Date | null;
  endsAt: Date | null;
  conditions: PromotionCondition;
}

export interface PricingContext {
  at: Date;
  /** Loyalty programmes the shopper participates in, e.g. ["xtra", "bonuskaart"]. */
  loyaltyPrograms: readonly string[];
  regionCode?: string | null;
  online?: boolean;
}

export type PromotionIneligibility =
  | 'NOT_ACTIVE'
  | 'LOYALTY_CARD_REQUIRED'
  | 'QUANTITY_TOO_LOW'
  | 'REGION_NOT_ELIGIBLE'
  | 'ONLINE_ONLY'
  | 'NO_BENEFIT_AT_QUANTITY';

export interface PromotionApplication {
  promotionId: string;
  /** Total to pay for `quantity` units with this promotion applied. */
  totalCents: Cents;
  /** Number of units that received a promotional price. */
  promotionalUnits: number;
  /** Smallest quantity at which this promotion yields any benefit. */
  minimumBeneficialQuantity: number;
}

export const DEFAULT_CONDITIONS: PromotionCondition = {
  loyaltyCardRequired: false,
  loyaltyProgram: null,
  minQuantity: null,
  maxQuantityPerCustomer: null,
  onlineOnly: false,
  regionCodes: [],
};

/** Reduced shelf price rounded half-up to the cent, as printed on the till receipt. */
const reducedPrice = (priceCents: Cents, percent: number): Cents => roundHalfUp((priceCents * (100 - percent)) / 100);

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`quantity must be a non-negative integer, got ${quantity}`);
  }
}

/**
 * PromotionCalculator applies ONE promotion mechanic to a purchase quantity.
 * It intentionally never collapses a mechanic into a flat percentage: the
 * price you pay depends on how many units you buy.
 *
 *   "2 voor €5" when buying 1 unit costs the regular price, not €2.50.
 */
export const PromotionCalculator = {
  /** Minimum quantity needed to trigger the mechanic. */
  groupSize(params: PromotionParams): number {
    switch (params.mechanic) {
      case 'BUY_X_GET_Y_FREE':
        return params.buy + params.free;
      case 'MULTI_BUY_FIXED_PRICE':
        return params.quantity;
      case 'NTH_ITEM_PERCENT_OFF':
        return params.nth;
      default:
        return 1;
    }
  },

  /**
   * Total cost for `units` units under the mechanic, ignoring conditions.
   * Units that do not complete a group are charged at the regular price.
   */
  totalForUnits(params: PromotionParams, regularUnitCents: Cents, units: number): Cents {
    assertQuantity(units);
    const p = regularUnitCents;
    switch (params.mechanic) {
      case 'PRICE_CUT':
        return units * Math.min(params.promoPriceCents, p);
      case 'PERCENT_OFF':
        return units * reducedPrice(p, params.percent);
      case 'AMOUNT_OFF':
        return units * Math.max(0, p - params.amountCents);
      case 'BUY_X_GET_Y_FREE': {
        const group = params.buy + params.free;
        const groups = Math.floor(units / group);
        const remainder = units % group;
        return (groups * params.buy + remainder) * p;
      }
      case 'MULTI_BUY_FIXED_PRICE': {
        const groups = Math.floor(units / params.quantity);
        const remainder = units % params.quantity;
        // A multi-buy that is more expensive than regular is never applied by the till.
        const groupPrice = Math.min(params.totalCents, params.quantity * p);
        return groups * groupPrice + remainder * p;
      }
      case 'NTH_ITEM_PERCENT_OFF': {
        const groups = Math.floor(units / params.nth);
        const remainder = units % params.nth;
        const discountedItem = reducedPrice(p, params.percent);
        return groups * ((params.nth - 1) * p + discountedItem) + remainder * p;
      }
    }
  },

  /** Why a promotion does not apply to this purchase, or null if it is eligible. */
  ineligibility(promotion: PricingPromotion, quantity: number, context: PricingContext): PromotionIneligibility | null {
    const c = promotion.conditions;
    if (!isWithin(context.at, promotion.startsAt, promotion.endsAt)) return 'NOT_ACTIVE';
    if (c.onlineOnly && !context.online) return 'ONLINE_ONLY';
    if (c.regionCodes.length > 0 && (!context.regionCode || !c.regionCodes.includes(context.regionCode))) {
      return 'REGION_NOT_ELIGIBLE';
    }
    if (c.loyaltyCardRequired && !(c.loyaltyProgram && context.loyaltyPrograms.includes(c.loyaltyProgram))) {
      return 'LOYALTY_CARD_REQUIRED';
    }
    const minQuantity = Math.max(c.minQuantity ?? 1, 1);
    if (quantity < minQuantity) return 'QUANTITY_TOO_LOW';
    return null;
  },

  /**
   * Apply a promotion to a purchase, honouring conditions such as a
   * maximum number of promotional units per customer.
   */
  apply(promotion: PricingPromotion, regularUnitCents: Cents, quantity: number): PromotionApplication {
    assertQuantity(quantity);
    const max = promotion.conditions.maxQuantityPerCustomer;
    const promoUnits = max != null ? Math.min(quantity, max) : quantity;
    const regularUnits = quantity - promoUnits;
    const totalCents =
      this.totalForUnits(promotion.params, regularUnitCents, promoUnits) + regularUnits * regularUnitCents;
    const group = this.groupSize(promotion.params);
    const promotionalUnits = group > 1 ? Math.floor(promoUnits / group) * group : promoUnits;
    return {
      promotionId: promotion.id,
      totalCents,
      promotionalUnits,
      minimumBeneficialQuantity: Math.max(group, promotion.conditions.minQuantity ?? 1),
    };
  },
};
