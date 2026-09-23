# Pricing engine

Package: `packages/pricing-engine`. It is pure and deterministic, and all amounts are integer cents. Tests: `pricing-engine.test.ts`, `price-history.test.ts`.

## UnitPriceCalculator

Converts a price for a net content into €/kg, €/l or €/piece:

| Input               | Unit price                                                   |
| ------------------- | ------------------------------------------------------------ |
| €2.49 for 500 g     | €4.98/kg                                                     |
| €3.49 for 750 g     | €4.65/kg (exact 465.33…) → the larger pack is cheaper per kg |
| €1.99 for 1.5 l     | €1.33/l                                                      |
| €3.99 for 12 pieces | €0.33/piece                                                  |

`compare()` compares without rounding (cross-multiplication) and refuses to compare different dimensions.

## PromotionCalculator: mechanics are quantity-aware

| Mechanic                | Example                    | 1 unit    | 2 units | 3 units |
| ----------------------- | -------------------------- | --------- | ------- | ------- |
| `BUY_X_GET_Y_FREE`      | 1+1 gratis at €2.50        | €2.50     | €2.50   | €5.00   |
| `MULTI_BUY_FIXED_PRICE` | 2 voor €5 (regular €2.99)  | **€2.99** | €5.00   | €7.99   |
| `MULTI_BUY_FIXED_PRICE` | 3 voor €10 (regular €4.49) | €4.49     | €8.98   | €10.00  |
| `NTH_ITEM_PERCENT_OFF`  | 2e halve prijs (€3.99)     | €3.99     | €5.99   | €9.98   |
| `PERCENT_OFF`           | -25 % (€3.99)              | €2.99     | €5.98   | …       |
| `AMOUNT_OFF`            | €0.50 korting              | …         |         |         |
| `PRICE_CUT`             | nu €1.99                   | €1.99     | €3.98   | …       |

The engine does not reduce a mechanic to a flat percentage. "2 voor €5" does not make one unit €2.50. Units that do not complete a group pay the regular price. A multi-buy that would cost more than the regular price is never applied. Reduced prices are rounded half-up to the cent.

Conditions (`promotion_conditions`) are checked in this order:

1. validity window
2. online only
3. region
4. **loyalty card** (Xtra, SuperPlus, Bonuskaart, Lidl Plus …)
5. minimum quantity
6. maximum promotional units per customer

## PricingEngine

- `calculateEffectivePrice(offer, quantity, context)`: applies the single best eligible promotion (no stacking, as at BE/NL tills). A shelf promo price is treated as an implicit `PRICE_CUT`.
  - It returns total, per-item, savings, discount %, applied promotion and effective unit price.
  - It also returns **missed promotions**: ones needing a card the shopper doesn't have (with the potential price), or a larger quantity (`NO_BENEFIT_AT_QUANTITY` with the minimum quantity).
- `calculateUnitPrice`, `calculateDiscount`.
- `comparePrices(offers, quantity, context, 'total' | 'unitPrice')`: ranking, ties and spread.
- `findCheapestRetailer`.

The shopper context carries the time and the loyalty programmes the user has cards for (from onboarding and settings).

## Price history

`summarizePriceHistory(points, { now, windowDays })` returns:

- current price (only if fresh, ≤ 7 days)
- lowest and highest
- a **time-weighted** average
- observation count
- coverage (0–1), `isComplete` (coverage ≥ 90 %) and explicit gaps
- daily points for charts

A price holds until the next observation, for at most 7 days. Beyond that it is a gap, not an invented value. `isHistoricalLow` requires at least 3 observations. The apps show _"Onvolledige prijsgeschiedenis"_ whenever `isComplete` is false.
