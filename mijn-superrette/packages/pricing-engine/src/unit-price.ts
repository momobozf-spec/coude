import {
  type BaseQuantity,
  type Cents,
  type ComparisonUnit,
  comparisonUnitFor,
  comparisonUnitSize,
  roundHalfUp,
} from '@superrette/shared';

export interface UnitPrice {
  /** Exact (fractional) price in cents per comparison unit. Use for sorting. */
  exactCents: number;
  /** Rounded to whole cents for display. */
  cents: Cents;
  per: ComparisonUnit;
}

/**
 * UnitPriceCalculator converts a price for a given net content into a price
 * per kilogram, litre or piece.
 *
 *   €2.49 for 500 g  -> €4.98 / kg
 *   €3.49 for 750 g  -> €4.65 / kg (exact 465.333…)
 */
export const UnitPriceCalculator = {
  calculate(priceCents: Cents, netContent: BaseQuantity | null | undefined): UnitPrice | null {
    if (!netContent || !(netContent.amount > 0) || priceCents < 0) return null;
    const per = comparisonUnitFor(netContent.unit);
    const exactCents = (priceCents * comparisonUnitSize(per)) / netContent.amount;
    return { exactCents, cents: roundHalfUp(exactCents), per };
  },

  /**
   * Compare two priced contents without rounding: negative when `a` is cheaper
   * per unit. Returns null when the contents are in different dimensions.
   */
  compare(
    a: { priceCents: Cents; netContent: BaseQuantity },
    b: { priceCents: Cents; netContent: BaseQuantity },
  ): number | null {
    if (a.netContent.unit !== b.netContent.unit) return null;
    // a.price / a.qty  vs  b.price / b.qty  <=>  a.price * b.qty vs b.price * a.qty
    return a.priceCents * b.netContent.amount - b.priceCents * a.netContent.amount;
  },
};
