# LeadRevive

LeadRevive finds dormant, high-potential opportunities inside an agency's existing
CRM database. It is tenant-isolated by construction.

## CSV import

MVP import path (`src/services/crm-import-service.ts` + `src/crm/csv-adapter.ts`):

1. Parse (RFC 4180; auto-detects `,` vs `;` — Belgian exports often use `;`).
2. Normalize each row (`src/crm/contact-normalizer.ts`): recognizes Dutch, French
   and English header variants (voornaam/prénom/firstname, gsm/téléphone/phone…),
   normalizes phones to E.164 (+32), emails to lowercase, postal codes, cities
   (with alias table: Gand→Gent…), name keys (order- and diacritic-insensitive),
   contact types (koper→BUYER, schatting→VALUATION_LEAD…) and statuses.
3. Deduplicate (`src/crm/dedupe.ts`), in priority order:
   - `externalContactId` (authoritative; contradictory email **and** phone →
     `CONFLICT`, never overwritten)
   - exact normalized email → update
   - exact normalized phone → update
   - name + postal code → `SKIP_DUPLICATE` (a common name alone must never merge
     two people)
   - otherwise → create
4. Updates **never silently overwrite**: incoming values only fill empty fields;
   `lastContactAt` only moves forward; `UNKNOWN` type/status can be upgraded.
5. Every row is recorded in `CrmImportRow` with its raw data and outcome — full
   import history and provenance, visible on the Imports screen.

## Dormant detection

`src/crm/dormant-detector.ts` surfaces categories (thresholds configurable):

| Category | Rule (defaults) |
| --- | --- |
| `DORMANT_VALUATION_LEAD` | valuation lead, no mandate, ≥ 12 months since contact |
| `FORMER_SELLER_PROSPECT` | seller lead with status LOST, ≥ 12 months |
| `LOST_MANDATE` | previously WON seller, ≥ 18 months |
| `OLD_BUYER` | bought ≥ 6 years ago (resell horizon) |
| `FORMER_CLIENT` | former client, ≥ 18 months |
| `UNCONTACTED_LEAD` | prospect ≥ 3 months old with no recorded contact |

Every result carries an explicit uncertainty statement — *"Historical signal only —
this does not prove current intent to sell."* — which is stored as a signal and
shown in the UI. Relationship scores are presented as relationship strength, never
as seller intent.

`LeadReviveService.scanAgency` creates one CRM-origin opportunity per
(contact, category), never duplicating existing ones.
