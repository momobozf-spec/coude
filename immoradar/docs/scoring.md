# Scoring

All scoring configuration is centralized in `src/scoring/config.ts` — no point
values or weights live in engines or UI. Every score returns `{ score, reasons }`.

## Intent score (`src/scoring/intent-score.ts`)

Strength of external market signals, 0–100. Raw points:

| Signal | Points |
| --- | --- |
| FSBO (private sale) | +40 |
| Price drop | +15 |
| Multiple price drops | +20 (on top of the first drop) |
| Listed > 30 days | +10 |
| Listed > 60 days | +15 (replaces the 30-day bonus) |
| Relisted | +20 |
| Agency → private | +20 |

Raw points normalize against `maxRawPoints` (50): a lone FSBO maps to 80, combined
signals saturate at 100. Intent measures signal strength, never proven intent.

## Relationship score (`src/scoring/relationship-score.ts`)

Value of an existing agency relationship, 0–100. Raw points (of `maxRawPoints` 80):

| Signal | Points |
| --- | --- |
| Previous buyer | +20 |
| Previous seller | +25 |
| Valuation request | +30 |
| Former client | +15 |
| Known property relationship | +15 |
| Recent interaction (≤ 6 months) | +15 |
| Same assigned agent still active | +5 |
| Landlord | +10 · Prospect +5 |

Explicitly **not** presented as proof of seller intent.

## Component scores

- **Timing** — freshness of the triggering signal: ≤24h → 100, ≤3d → 85, ≤1w → 70,
  ≤2w → 50, older → 30.
- **Territory** — match precision: postal code 100, municipality 85, province 60,
  outside territory 0.
- **Data confidence** — mean of available confidences (seller classification,
  property match, CRM match) × 100.

## Combined opportunity score (`src/scoring/opportunity-score.ts`)

**Not a sum.** Components are normalized 0–100 first, then combined with weights
that sum to 1:

```
intent 0.40 · relationship 0.25 · timing 0.10 · territory 0.10 · confidence 0.15
```

- **Missing relationship redistribution** — market-only opportunities (no CRM
  relationship at all) redistribute the relationship weight proportionally over the
  other components, so they are not structurally capped at 75.
- **Cross-intelligence boost** — when a market signal and a CRM relationship
  combine, the total is multiplied by 1.2 (capped at 100). This encodes the core
  product thesis: existing relationship + market signal is the highest-priority
  acquisition situation.
- Headline reasons are assembled from the strongest component reasons and stored
  with the full breakdown JSON on `OpportunityScore` for the explanation UI.

## Calibration reference (demo scenarios)

| Scenario | Approximate score |
| --- | --- |
| A — fresh FSBO, exact territory, no CRM | high 80s |
| C — private, 67 days, 2 drops, no CRM | mid 90s |
| B/E — market signal + existing CRM relationship | high 90s–100 |

Tests in `tests/scoring.test.ts` pin these properties (normalization, redistribution,
cap, cross-boost ordering).
