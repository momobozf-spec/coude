import type { Cents } from '@superrette/shared';
import type { SmartBasketResult, SmartPlan } from './smart-basket.js';

/**
 * Fee schedule for the optional "wij doen je boodschappen" service. All
 * amounts are what the customer pays, VAT included. The schedule is server
 * configuration: never hard-code it in UI code.
 */
export interface FulfilmentFeeSchedule {
  /** Fixed fee per order (service + delivery), in cents. */
  baseFeeCents: Cents;
  /** Variable fee on the shelf-price subtotal, in basis points (800 = 8%). */
  percentBasisPoints: number;
  /** Surcharge for every store beyond the first. */
  extraStoreFeeCents: Cents;
  /** Orders below this shelf-price subtotal are refused. */
  minimumOrderCents: Cents;
  /** Optional cap on the variable part. */
  maxPercentFeeCents?: Cents;
}

export interface FulfilmentQuote {
  storeCount: number;
  shelfSubtotalCents: Cents;
  baseFeeCents: Cents;
  percentFeeCents: Cents;
  extraStoreFeeCents: Cents;
  feeTotalCents: Cents;
  customerTotalCents: Cents;
  /** null when the order is allowed, otherwise why not. */
  refusal: 'BELOW_MINIMUM' | 'NO_STORES' | null;
}

export interface DeliveredOption {
  plan: SmartPlan;
  quote: FulfilmentQuote;
}

export interface DeliveredComparison {
  /** Every orderable option (each single store, plus the best combination), cheapest delivered total first. */
  options: DeliveredOption[];
  best: DeliveredOption | null;
  /**
   * True when splitting looked cheaper on shelf prices but stops being cheaper
   * once the extra-store fee is included. The UI explains this to the customer.
   */
  combiningEatenByFees: boolean;
}

/** Round half-up to whole cents. */
const roundCents = (x: number): Cents => Math.floor(x + 0.5);

export const FulfilmentPricing = {
  quote(shelfSubtotalCents: Cents, storeCount: number, schedule: FulfilmentFeeSchedule): FulfilmentQuote {
    const percentRaw = roundCents((shelfSubtotalCents * schedule.percentBasisPoints) / 10_000);
    const percentFeeCents =
      schedule.maxPercentFeeCents == null ? percentRaw : Math.min(percentRaw, schedule.maxPercentFeeCents);
    const extraStoreFeeCents = Math.max(0, storeCount - 1) * schedule.extraStoreFeeCents;
    const feeTotalCents = schedule.baseFeeCents + percentFeeCents + extraStoreFeeCents;
    const refusal =
      storeCount < 1 ? 'NO_STORES' : shelfSubtotalCents < schedule.minimumOrderCents ? 'BELOW_MINIMUM' : null;
    return {
      storeCount,
      shelfSubtotalCents,
      baseFeeCents: schedule.baseFeeCents,
      percentFeeCents,
      extraStoreFeeCents,
      feeTotalCents,
      customerTotalCents: shelfSubtotalCents + feeTotalCents,
      refusal,
    };
  },

  /**
   * Compare single-store and combined plans on what the customer actually
   * pays: shelf prices plus service, delivery and extra-store fees. Only plans
   * with the same coverage as the best plan compete, so a cheaper but
   * incomplete basket never wins.
   */
  compare(result: SmartBasketResult, schedule: FulfilmentFeeSchedule): DeliveredComparison {
    const plans: SmartPlan[] = [...result.singleStore];
    const combined = result.recommendCombining ? result.best : null;
    // `best` is only returned as a combination when combining won on shelf
    // prices; re-evaluate the strongest multi-store plan we were given.
    const candidates = combined && combined.retailerIds.length > 1 ? [...plans, combined] : plans;
    const maxFound = Math.max(0, ...candidates.map((p) => p.foundCount));
    const options = candidates
      .filter((p) => p.foundCount === maxFound && p.retailerIds.length > 0)
      .map((plan) => ({ plan, quote: this.quote(plan.totalCents, plan.retailerIds.length, schedule) }))
      .filter((o) => o.quote.refusal === null)
      .sort(
        (a, b) =>
          a.quote.customerTotalCents - b.quote.customerTotalCents ||
          a.quote.storeCount - b.quote.storeCount ||
          (a.plan.retailerIds[0] ?? '').localeCompare(b.plan.retailerIds[0] ?? ''),
      );
    const best = options[0] ?? null;
    const combiningEatenByFees = combined != null && best != null && best.quote.storeCount === 1;
    return { options, best, combiningEatenByFees };
  },
};
