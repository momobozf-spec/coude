# CRM ↔ market matching

When ImmoRadar detects a market signal, it asks each agency's CRM (separately, tenant-scoped) whether the seller might be someone the agency already knows.

## Subject (from the market side)

`sellerPhone` (E.164), `sellerEmail`, `sellerNormalizedName`, property `addressKey`, `postalCode`, `propertyId` — taken from the latest listing snapshot and the matched property.

## Candidates (from one tenant's CRM)

`findCrmMatch()` (`src/services/crm-match-service.ts`) queries **only** `CrmContact` rows with the agency's id, pre-filtered by phone, email, address key, historical relationship (address key or property id) or normalized name. Candidates are scored by `scoreCrmCandidate()` (`src/crm/crm-matcher.ts`).

## Weights (`DEFAULT_CRM_MATCH_WEIGHTS`)

| Signal | Weight | Identity signal? |
| --- | --- | --- |
| Exact normalized phone | 0.90 | yes |
| Exact email | 0.85 | yes |
| Historical relationship with this property / address | 0.80 | yes |
| Contact address equals the property address | 0.75 | yes |
| Exact normalized name | 0.35 | no |
| Similar name (Levenshtein ≥ 0.85) | 0.20 | no |
| Same postal code | 0.08 | no |

Threshold: 0.60. **Without at least one identity signal the score is capped below the threshold**, so two people who merely share a common name (even in the same postcode) never match. The best candidate wins.

## Result

```json
{ "crmMatch": true, "confidence": 0.96, "contactId": "…", "reasons": ["Exact normalized phone match", "Matching property postcode"] }
```

Stored on the opportunity (`crmMatched`, `crmMatchConfidence`, `crmMatchReasons`), logged as a `CRM_MATCHED` activity, used by the relationship score and the cross-intelligence bonus, and shown on the detail page.

Tested in `src/crm/crm.test.ts` (weights, name-only rejection) and `tests/integration/tenant-isolation.test.ts` (a second agency never sees the match).
