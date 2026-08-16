# CRM ↔ market matching

One of the most important features: when ImmoRadar detects a market opportunity, it
searches the agency's own CRM for a potential relationship with the seller.
Implementation: `src/crm/crm-market-matcher.ts`, invoked per-agency by
`OpportunityService` through the tenant-scoped repository — candidate contacts are
always and only the processing agency's own.

## Evidence model

Signals are collected as weighted evidence:

| Evidence | Weight | Standalone? |
| --- | --- | --- |
| Exact normalized phone match (E.164) | 0.90 | yes |
| Exact email match | 0.85 | yes |
| Known relationship with this property | 0.80 | yes |
| Normalized name match | 0.45 | **no** |
| Matching property postcode (only with name) | 0.30 | no |
| Contact address contains property street (only with name) | 0.35 | no |

Rules:

- **A name alone never matches.** Non-standalone evidence requires corroboration
  (≥ 2 pieces), so two people who merely share a common name can never be linked.
- Evidence combines with a noisy-or (`1 - Π(1 - w)`), rewarding converging signals
  while staying in [0, 1).
- Purely circumstantial matches (no standalone evidence) are capped at 0.8
  confidence — below certainty by design.
- The default match threshold is 0.75; results always include the reason list, e.g.

```json
{
  "crmMatch": true,
  "confidence": 0.96,
  "contactId": "…",
  "reasons": ["Exact normalized phone match", "Matching property postcode"]
}
```

## Effect of a match

- The opportunity's origin becomes `CROSS`, its contact is linked, and match
  confidence/reasons are stored on the opportunity for the explanation UI.
- The relationship score joins the combined opportunity score, and the
  cross-intelligence boost applies (see `scoring.md`).
- Qualifying opportunities produce a high-priority `CRM_MARKET_MATCH` alert.

## Tenant guarantee

Matching runs inside `tenantDb(agencyId)`; the candidate query cannot cross tenants.
`tests/tenant-isolation.test.ts` proves that the same market listing produces a CRM
match only for the agency that owns the contact.
