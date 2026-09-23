# Scoring

All weights live in `src/scoring/config.ts` (`SCORING_CONFIG_VERSION` is stored with every score) and are covered by `src/scoring/scoring.test.ts`.

## Intent score (market signals)

| Signal | Points |
| --- | --- |
| FSBO (private seller) | +40 |
| Price drop | +15 |
| Multiple price drops | +20 |
| Listing > 30 days | +10 |
| Listing > 60 days | +15 |
| Listing > 90 days | +5 |
| Relisted | +20 |
| Agency → private | +20 |

Raw points are normalised: `score = min(100, raw / 55 × 100)`. A bare FSBO scores 73; FSBO + 2 drops + 60 days scores 100.

## Relationship score (existing CRM relationship)

| Signal | Points |
| --- | --- |
| Previous buyer | +20 |
| Previous seller | +25 |
| Valuation request | +30 |
| Former client | +15 |
| Landlord | +15 |
| Lost mandate | +20 |
| Known property relationship | +15 |
| Recent interaction (≤ 6 months) | +15 |
| Same assigned agent still available | +5 |

Normalised with a reference max of 60 (valuation + property + agent = 50 → 83). It estimates the warmth of a relationship, **not** seller intent.

## Timing

Market: hours since the latest signal → 100 (< 1 h), 90 (today), 70 (this week), 45 (this month), 20. Dormancy (LeadRevive): months since last contact → 25 (< 6), 55 (< 12), 85 (1–3 years), 65 (3–6 years), 45.

## Territory

Postal code 100 · municipality 75 · province 40 · none 0. Opportunities are only created when matched.

## Data confidence

Average of seller-classification confidence, property-match confidence (auto-matched listings only) and CRM-match confidence, minus 5 per normalization warning (max −20).

## Combined opportunity score

```
base = Σ wᵢ · componentᵢ / Σ wᵢ                      (profile weights, normalised)
lift = relationship/100 · relationshipLift + crossIntelligenceBonus · crmMatchConfidence
score = base + (100 − base) · min(1, lift)
```

| Profile | intent | relationship | timing | territory | confidence | lift | cross bonus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IMMORADAR | 0.45 | – | 0.25 | 0.15 | 0.15 | 0.9 | 0.3 |
| LEADREVIVE | – | 0.55 | 0.25 | 0.10 | 0.10 | – | – |

The relationship therefore *lifts* a market opportunity towards 100 instead of being averaged in — a hot FSBO in territory already scores ~88 on its own, and an existing relationship pushes it to 97–100.

## Scenario checks (unit-tested)

| Scenario | Result |
| --- | --- |
| A — new FSBO, no CRM relationship | 86–90 |
| B — new FSBO + previous buyer 2019 | ≥ 97 |
| C — private seller, 67 days, 2 price drops | 92–96 |
| D — dormant valuation request (LeadRevive) | relationship 83, total 65–85 |
| E — relisted property + previous relationship | ≥ 97 |

Scores are never presented as proof of intent; the detail page lists every reason with its component.
