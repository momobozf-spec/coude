# Product normalisation & matching

Package: `packages/product-matching`. It is pure TypeScript, deterministic, and covered by unit tests (`normalizer.test.ts`, `matching-engine.test.ts`, `equivalence-engine.test.ts`).

## ProductNormalizer

The normaliser turns retailer text into a comparable representation:

```
"Coca-Cola Zero Sugar fles 1,5 liter"
  → brand coca-cola · type cola · variants [zero] · dietary [sugar_free]
    net content 1500 ml · signature "coca-cola|cola|zero|-|1500ml"
```

| Step                        | Details                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GTIN                        | Check digit validated. UPC-A and GTIN-14 are normalised to GTIN-13. Invalid codes are dropped and never guessed.                                                                              |
| Brand                       | Dictionary aliases. The earliest match in the title wins, then the longest. Private labels carry their retailer (Boni → Colruyt, AH → Albert Heijn). An unknown explicit brand is kept as-is. |
| Quantity                    | `1,5 liter`, `1.5L`, `1500ml`, `33cl`, `6 x 33 cl`, `4x125g`, `0,5 kg`, `12 stuks`, `44 luiers`, `per kilo`, `ca. 1 kg`. The canonical units are g, ml and piece, and the pack count is kept. |
| Decompounding               | Dutch compounds are split on known heads: `volkorenbrood` → `volkoren brood`, `scharreleieren` → `scharrel eieren`. A word that is itself a known synonym (`kipfilet`) is not split.          |
| Synonyms (NL/FR/EN)         | `halfvolle` / `demi-écrémé` / `semi skimmed` → `halfvol`, `lait` / `melk` / `milk` → `melk`, `zero sugar` / `sans sucres` → `zero`, and so on.                                                |
| Product type                | The most specific rule wins: `melk`+`halfvol` → `milk-semi-skimmed`.                                                                                                                          |
| Variant / flavour / dietary | `zero`, `light`, `cafeinevrij`, `volkoren` … / `cherry`, `lime` … / `bio`, `lactosevrij`, `glutenvrij`, `vegan`, `halal` …                                                                    |
| Size                        | `maat 4` / `taille 4` is kept as a size attribute and not mistaken for a quantity.                                                                                                            |

The dictionary is data. The API and worker extend the defaults with brands and synonyms from `catalog.brands` and `catalog.synonyms` (`loadDictionary`).

## ProductMatchingEngine: "is this the same product?"

Priority:

1. **Confirmed human mapping.** `EXACT`, method `CONFIRMED_MAPPING`, always wins.
2. **GTIN.** `EXACT`, method `GTIN`. If two canonical products share the GTIN, the match goes to review.
3. **Attribute scoring:**

| Signal                            | Weight | Hard rule                                     |
| --------------------------------- | ------ | --------------------------------------------- |
| Brand                             | 0.25   | different known brands → score capped at 0.30 |
| Name (canonical tokens ∪ trigram) | 0.35   | —                                             |
| Size (±1 %)                       | 0.25   | different size → capped at 0.40               |
| Product type                      | 0.10   | different type → capped at 0.30               |
| Variant / flavour                 | —      | any conflict → capped at 0.45                 |
| Category                          | 0.05   | —                                             |

| Confidence | Condition                                          | Policy (default)                                                              |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| EXACT      | GTIN / confirmed mapping                           | auto-link                                                                     |
| HIGH       | score ≥ 0.90 **and** same brand, size and variants | auto-link                                                                     |
| MEDIUM     | score ≥ 0.75                                       | review queue, not linked                                                      |
| LOW        | score ≥ 0.50                                       | review queue, not linked                                                      |
| UNMATCHED  | below 0.50                                         | create a new canonical product (flagged `needs_review` when there is no GTIN) |

A HIGH match with a runner-up within 0.03 is downgraded to MEDIUM. **Low-confidence results are never merged automatically.** Rejected pairs are never proposed again.

## Human review (admin)

`/v1/admin/matches`, and the admin UI **Product match review** screen, offer:

- **Goedkeuren**: CONFIRMED, links the retailer product and attaches its GTINs.
- **Afwijzen**: REJECTED, unlinks it, then re-matches (the next best candidate, or a new canonical product).
- **Ander product**: reassign to any canonical variant. This records a MANUAL, CONFIRMED match.

The pipeline reads CONFIRMED and REJECTED rows as mapping memory, so human corrections survive every future import. The integration test `admin › reviews product matches and persists human corrections` covers this.

## ProductEquivalenceEngine: "what is comparable elsewhere?"

Example: Boni Halfvolle Melk 1L ≈ AH Halfvolle Melk 1L. The brands and GTINs differ, but the products are comparable.

- The product type must agree. If the type is unknown, the same category gives partial credit.
- Variants and flavours must agree: cola zero is never equivalent to regular cola.
- Strict dietary guarantees (lactose-free, gluten-free, vegan, vegetarian, halal, sugar-free) must be preserved. Losing _organic_ is a penalty, not a veto.
- Quantity must be in the same dimension. Within the ±25 % tolerance the score decreases smoothly; beyond 2× the pair is rejected.
- Brand preference: same brand > both private label > other. Callers can require `same` or prefer `private_label`.
- Semantic similarity goes through a pluggable `SimilarityScorer` interface. The default is lexical (canonical tokens + trigrams). An embedding scorer can be added later without changing callers.

The output shape is `{ sourceProduct, targetProduct, matchType: 'EQUIVALENT' | 'EXACT', confidence, reasons }`.

`EquivalenceIndexer` (ingestion) precomputes SUGGESTED pairs after catalogue syncs. Admins confirm or reject them, and the reverse pair follows. Users can override any equivalent per retailer in the basket ("Wijzig product").
