import type { Cents } from '@superrette/shared';
import type { BasketComparison, BasketLineChoice } from './basket-comparison.js';

export interface SmartBasketOptions {
  /** Maximum number of supermarkets to combine (1-3 today; engine supports any). */
  maxStores: number;
  /** Cost of visiting an additional store (travel/fuel), in cents. Future variable. */
  extraStoreCostCents?: Cents;
  /** Only recommend combining when it saves at least this much. */
  minSavingsCents?: Cents;
}

export interface SmartAssignment {
  itemId: string;
  retailerId: string;
  choice: BasketLineChoice;
}

export interface SmartPlan {
  retailerIds: string[];
  totalCents: Cents;
  /** Total including the configured per-extra-store cost. */
  adjustedTotalCents: Cents;
  foundCount: number;
  missingItemIds: string[];
  perRetailer: { retailerId: string; subtotalCents: Cents; itemIds: string[] }[];
  assignments: SmartAssignment[];
}

export interface SmartBasketResult {
  singleStore: SmartPlan[];
  best: SmartPlan | null;
  /** Best single-store plan with the same coverage as `best`. */
  bestSingleStore: SmartPlan | null;
  savingsCents: Cents;
  recommendCombining: boolean;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, acc: T[]): void => {
    if (acc.length === k) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return result;
}

const better = (a: SmartPlan, b: SmartPlan): boolean =>
  a.foundCount > b.foundCount ||
  (a.foundCount === b.foundCount &&
    (a.adjustedTotalCents < b.adjustedTotalCents ||
      (a.adjustedTotalCents === b.adjustedTotalCents && a.retailerIds.length < b.retailerIds.length)));

/**
 * Superrette Smart Basket: "Hoe doe ik deze boodschappen het goedkoopst?"
 * Exhaustively evaluates every combination of up to `maxStores` retailers
 * (C(12,3) = 220 combinations for a dozen retailers — trivially fast) and
 * assigns each item to the cheapest store in the combination. Coverage is
 * maximised first; a plan that finds more items always wins.
 */
export const SmartBasketOptimizer = {
  optimize(comparison: BasketComparison, options: SmartBasketOptions): SmartBasketResult {
    const maxStores = Math.max(1, Math.floor(options.maxStores));
    const extraCost = options.extraStoreCostCents ?? 0;
    const retailerIds = comparison.retailers.map((r) => r.retailerId);
    const lineIndex = new Map<string, Map<string, BasketLineChoice | null>>();
    const itemIds: string[] = comparison.retailers[0]?.lines.map((l) => l.itemId) ?? [];
    for (const r of comparison.retailers) {
      lineIndex.set(r.retailerId, new Map(r.lines.map((l) => [l.itemId, l.selected])));
    }

    const plan = (ids: string[]): SmartPlan => {
      const assignments: SmartAssignment[] = [];
      const missing: string[] = [];
      for (const itemId of itemIds) {
        let best: SmartAssignment | null = null;
        for (const rid of ids) {
          const choice = lineIndex.get(rid)?.get(itemId);
          if (!choice) continue;
          if (!best || choice.price.totalCents < best.choice.price.totalCents) best = { itemId, retailerId: rid, choice };
        }
        if (best) assignments.push(best);
        else missing.push(itemId);
      }
      const used = ids.filter((id) => assignments.some((a) => a.retailerId === id));
      const perRetailer = used.map((retailerId) => {
        const mine = assignments.filter((a) => a.retailerId === retailerId);
        return {
          retailerId,
          subtotalCents: mine.reduce((s, a) => s + a.choice.price.totalCents, 0),
          itemIds: mine.map((a) => a.itemId),
        };
      });
      const totalCents = assignments.reduce((s, a) => s + a.choice.price.totalCents, 0);
      return {
        retailerIds: used,
        totalCents,
        adjustedTotalCents: totalCents + Math.max(0, used.length - 1) * extraCost,
        foundCount: assignments.length,
        missingItemIds: missing,
        perRetailer,
        assignments,
      };
    };

    const singleStore = retailerIds.map((id) => plan([id]));
    let best: SmartPlan | null = null;
    for (let k = 1; k <= Math.min(maxStores, retailerIds.length); k++) {
      for (const combo of combinations(retailerIds, k)) {
        const p = plan(combo);
        if (!best || better(p, best)) best = p;
      }
    }

    const bestSingleStore =
      singleStore
        .filter((p) => !best || p.foundCount === best.foundCount)
        .sort((a, b) => a.totalCents - b.totalCents)[0] ?? null;

    const savingsCents = best && bestSingleStore ? bestSingleStore.totalCents - best.adjustedTotalCents : 0;
    // Combining is recommended when it saves enough, or when it is the only
    // way to find more of the list than any single store can.
    const recommendCombining =
      best != null &&
      best.retailerIds.length > 1 &&
      (bestSingleStore == null || savingsCents >= (options.minSavingsCents ?? 1));

    return {
      singleStore: [...singleStore].sort((a, b) => b.foundCount - a.foundCount || a.totalCents - b.totalCents),
      best: recommendCombining || !bestSingleStore ? best : bestSingleStore,
      bestSingleStore,
      savingsCents: recommendCombining ? savingsCents : 0,
      recommendCombining,
    };
  },
};
