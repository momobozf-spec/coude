# Basket comparison & Smart Basket

Packages: `packages/basket-engine` (pure), plus `apps/api/src/modules/lists/basket.service.ts` for candidate discovery.

## Candidate discovery (API)

| List item                                      | Candidates                                  | Match type      | Confidence                                                                                  |
| ---------------------------------------------- | ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| Has a preferred product (`preferredVariantId`) | that variant                                | `EXACT`         | 1.0                                                                                         |
|                                                | its equivalences (not rejected)             | `EQUIVALENT`    | stored confidence; confirmed pairs ≥ 0.95                                                   |
| Free text ("melk", "cola zero")                | search ranking (canonical tokens + trigram) | `GENERIC`       | `min(0.95, 0.45 + 0.45·tokenRatio + 0.15·similarity)`; a `preferredBrand` adds or subtracts |
| User override ("Wijzig product")               | the chosen retailer product                 | `USER_SELECTED` | the candidate's confidence                                                                  |

Checked-off items stay in the comparison, so ticking items off while shopping doesn't change totals.

## BasketComparisonEngine

For every retailer and every item it:

1. Honours the user's selection when there is one.
2. Otherwise selects the exact product if the retailer sells it.
3. Otherwise selects the cheapest candidate among those within 0.15 of the best confidence at that retailer. Candidates below `minConfidence` (0.6) are never selected automatically, but are counted as `lowConfidenceOptions`.
4. Prices each line with the `PricingEngine` at the item quantity, so "2 voor €5" and "1+1" are applied correctly.
5. Returns every alternative sorted by price. This powers "Wijzig product".

The result per retailer includes:

- total, regular total and promotion savings
- found / item count, `isComplete`, and exact vs equivalent counts
- **missing item ids**
- average confidence
- every line with status (`EXACT`, `EQUIVALENT`, `GENERIC`, `USER_SELECTED`, `MISSING`) and confidence

Retailers are ranked complete first (cheapest first), then by coverage, then by price. **Missing products are never hidden or priced as zero.** The Free plan compares up to N retailers, set by the server-side limit `basket_comparison`. The response says so (`retailerLimit`).

## Superrette Smart Basket

_"Hoe doe ik deze boodschappen het goedkoopst?"_

`SmartBasketOptimizer.optimize(comparison, { maxStores, extraStoreCostCents?, minSavingsCents? })`:

- Evaluates **every** combination of up to `maxStores` retailers. C(12,3) = 220, which is trivial.
- Assigns each item to the cheapest store in the combination.
- Maximises coverage first: a plan that finds more items always wins.
- Adds `extraStoreCostCents` for every additional store. This is the future hook for travel distance and fuel cost.
- Recommends combining only when savings are at least `minSavingsCents`, or when combining is the only way to find more items.
- Returns all single-store plans ("Alles bij Colruyt …"), the best plan with a per-store split, the best single store with the same coverage, and the saving.

Example from the development data (demo list of six items, max 2 stores):

```
Alles bij Lidl        € 14,94
Alles bij Colruyt     € 15,70
Slim combineren: Lidl € 8,95 + Delhaize € 5,49 = € 14,44 → je bespaart € 0,50
```

## Tests

- Unit (`basket-engine.test.ts`): totals, ranking, missing items, user selection recalculation, exact-over-equivalent, low-confidence never selected, promotions inside baskets, 1/2/3-store optimisation, store cost, minimum saving, coverage-first.
- Integration (`vertical-slices.test.ts`): vertical slice 2 end to end (create list → compare → change the product at Colruyt → total updates → reset).
