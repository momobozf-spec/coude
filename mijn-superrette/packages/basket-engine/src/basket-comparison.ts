import type { Cents } from '@superrette/shared';
import type { BasketMatchType } from '@superrette/domain';
import { PricingEngine, type EffectivePrice, type PricedOffer, type PricingContext } from '@superrette/pricing-engine';

export interface BasketItemInput {
  id: string;
  title: string;
  quantity: number;
}

export interface BasketRetailer {
  id: string;
  name: string;
}

/**
 * A product at a retailer that could fulfil a list item. Candidate discovery
 * (search, exact matching, equivalence) happens outside the engine; the
 * engine only decides, prices and explains.
 */
export interface BasketCandidate {
  itemId: string;
  retailerId: string;
  productId: string;
  retailerProductId: string;
  productName: string;
  brandName: string | null;
  /** EXACT = the preferred product itself; EQUIVALENT = comparable product; GENERIC = matched from free text. */
  matchType: Extract<BasketMatchType, 'EXACT' | 'EQUIVALENT' | 'GENERIC'>;
  /** 0..1 */
  confidence: number;
  offer: PricedOffer;
}

export interface BasketComparisonInput {
  items: readonly BasketItemInput[];
  retailers: readonly BasketRetailer[];
  candidates: readonly BasketCandidate[];
  /** User overrides: key `${itemId}:${retailerId}` -> retailerProductId. */
  selections?: ReadonlyMap<string, string>;
  context: PricingContext;
  options?: BasketOptions;
}

export interface BasketOptions {
  /** Candidates below this confidence are never selected automatically. */
  minConfidence?: number;
  /** Only candidates within this distance of the best confidence compete on price. */
  confidenceBand?: number;
}

export interface BasketLineChoice {
  productId: string;
  retailerProductId: string;
  productName: string;
  brandName: string | null;
  matchType: BasketCandidate['matchType'];
  confidence: number;
  price: EffectivePrice;
}

export interface BasketLine {
  itemId: string;
  title: string;
  quantity: number;
  status: BasketMatchType;
  confidence: number | null;
  selected: BasketLineChoice | null;
  /** All eligible options at this retailer, cheapest first — powers "Wijzig product". */
  alternatives: BasketLineChoice[];
  /** Candidate discovered but below the confidence threshold (shown, never auto-picked). */
  lowConfidenceOptions: number;
}

export interface RetailerBasket {
  retailerId: string;
  retailerName: string;
  totalCents: Cents;
  regularTotalCents: Cents;
  savingsCents: Cents;
  foundCount: number;
  itemCount: number;
  isComplete: boolean;
  exactCount: number;
  equivalentCount: number;
  missingItemIds: string[];
  /** Mean confidence of the selected lines, 0..1. */
  averageConfidence: number | null;
  lines: BasketLine[];
}

export interface BasketComparison {
  retailers: RetailerBasket[];
  cheapestCompleteRetailerId: string | null;
  itemCount: number;
}

export const selectionKey = (itemId: string, retailerId: string): string => `${itemId}:${retailerId}`;

function toChoice(c: BasketCandidate, price: EffectivePrice): BasketLineChoice {
  return {
    productId: c.productId,
    retailerProductId: c.retailerProductId,
    productName: c.productName,
    brandName: c.brandName,
    matchType: c.matchType,
    confidence: c.confidence,
    price,
  };
}

const byPriceThenConfidence = (a: BasketLineChoice, b: BasketLineChoice): number =>
  a.price.totalCents - b.price.totalCents || b.confidence - a.confidence || a.retailerProductId.localeCompare(b.retailerProductId);

/**
 * BasketComparisonEngine prices a whole shopping list at every retailer and
 * explains each line: exact match, equivalent, user choice or missing.
 * Missing products are never hidden and never silently priced at zero.
 */
export const BasketComparisonEngine = {
  compare(input: BasketComparisonInput): BasketComparison {
    const minConfidence = input.options?.minConfidence ?? 0.6;
    const band = input.options?.confidenceBand ?? 0.15;
    const selections = input.selections ?? new Map<string, string>();

    const byKey = new Map<string, BasketCandidate[]>();
    for (const c of input.candidates) {
      const key = selectionKey(c.itemId, c.retailerId);
      const list = byKey.get(key);
      if (list) list.push(c);
      else byKey.set(key, [c]);
    }

    const retailers: RetailerBasket[] = input.retailers.map((retailer) => {
      const lines: BasketLine[] = input.items.map((item) => {
        const key = selectionKey(item.id, retailer.id);
        const all = byKey.get(key) ?? [];
        const priced = all.map((c) => ({
          c,
          price: PricingEngine.calculateEffectivePrice(c.offer, item.quantity, input.context),
        }));
        const eligible = priced.filter((p) => p.c.matchType === 'EXACT' || p.c.confidence >= minConfidence);
        const alternatives = eligible.map((p) => toChoice(p.c, p.price)).sort(byPriceThenConfidence);
        const lowConfidenceOptions = priced.length - eligible.length;

        const selectedId = selections.get(key);
        const userChoice = selectedId ? priced.find((p) => p.c.retailerProductId === selectedId) : undefined;
        if (userChoice) {
          return {
            itemId: item.id,
            title: item.title,
            quantity: item.quantity,
            status: 'USER_SELECTED',
            confidence: userChoice.c.confidence,
            selected: toChoice(userChoice.c, userChoice.price),
            alternatives,
            lowConfidenceOptions,
          };
        }

        // Prefer the exact preferred product; otherwise the cheapest among the
        // most confident comparable options.
        const exact = alternatives.filter((a) => a.matchType === 'EXACT');
        let selected: BasketLineChoice | null = null;
        if (exact.length > 0) selected = exact[0]!;
        else if (alternatives.length > 0) {
          const bestConfidence = Math.max(...alternatives.map((a) => a.confidence));
          selected = alternatives.filter((a) => a.confidence >= bestConfidence - band).sort(byPriceThenConfidence)[0]!;
        }

        return {
          itemId: item.id,
          title: item.title,
          quantity: item.quantity,
          status: selected ? selected.matchType : 'MISSING',
          confidence: selected ? selected.confidence : null,
          selected,
          alternatives,
          lowConfidenceOptions,
        };
      });

      const found = lines.filter((l) => l.selected);
      const totalCents = found.reduce((sum, l) => sum + l.selected!.price.totalCents, 0);
      const regularTotalCents = found.reduce((sum, l) => sum + l.selected!.price.regularTotalCents, 0);
      return {
        retailerId: retailer.id,
        retailerName: retailer.name,
        totalCents,
        regularTotalCents,
        savingsCents: regularTotalCents - totalCents,
        foundCount: found.length,
        itemCount: lines.length,
        isComplete: found.length === lines.length,
        exactCount: lines.filter((l) => l.status === 'EXACT').length,
        equivalentCount: lines.filter((l) => l.status === 'EQUIVALENT' || l.status === 'GENERIC').length,
        missingItemIds: lines.filter((l) => !l.selected).map((l) => l.itemId),
        averageConfidence:
          found.length > 0 ? Math.round((found.reduce((s, l) => s + l.selected!.confidence, 0) / found.length) * 100) / 100 : null,
        lines,
      };
    });

    // Complete baskets first (cheapest first), then by coverage, then price.
    retailers.sort(
      (a, b) =>
        Number(b.isComplete) - Number(a.isComplete) ||
        b.foundCount - a.foundCount ||
        a.totalCents - b.totalCents ||
        a.retailerName.localeCompare(b.retailerName),
    );

    return {
      retailers,
      cheapestCompleteRetailerId: retailers.find((r) => r.isComplete)?.retailerId ?? null,
      itemCount: input.items.length,
    };
  },
};
