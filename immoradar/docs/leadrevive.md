# LeadRevive

LeadRevive finds dormant, high-potential relationships inside an agency's **own** CRM data. It never uses another tenant's data.

## Import

1. Agency admin uploads a CSV (`/imports`). `CsvCrmAdapter` auto-maps headers (NL/FR/EN aliases in `src/crm/adapters/csv-crm-adapter.ts`), parses Belgian date formats and maps contact types/statuses.
2. Each row is normalized (`src/crm/contact-normalizer.ts`): folded name, E.164 phone, lower-cased email, address key, postal code.
3. Deduplication key priority: `ext:<crm id>` → `phone:` → `email:` → `name|postcode` → `name`. Rows with no name/email/phone are `INVALID`; identical keys inside one file are `DUPLICATE`.
4. Existing contacts (found by dedupe key, CRM id, phone or email inside the tenant) are **merged conservatively**: empty fields are filled (`UPDATED`), newer `lastContactAt` is accepted, any differing value is recorded as a `CONFLICT` on the import row and **not** overwritten.
5. Property relationship hints (`relationshipType`, `relationshipYear`, `propertyAddress`) become `ContactPropertyRelationship` rows keyed by address; they are linked to `Property` rows as soon as the market data contains that address.
6. `CrmImport` + `CrmImportRow` keep full provenance (raw values per row, counters, who imported when).

## Dormant detection (`src/crm/dormant-detector.ts`)

Runs nightly (`jobs:leadrevive`) and after every import. A contact is *dormant* when its last contact (or creation) is older than the agency's `dormantMonths` (default 12).

| Category | Rule |
| --- | --- |
| `DORMANT_VALUATION_LEAD` | valuation lead / valuation relationship, no mandate won |
| `LOST_MANDATE` | seller with status `LOST` |
| `FORMER_SELLER_PROSPECT` | other seller leads not won |
| `OLD_BUYER` | buyer / `BOUGHT` relationship ≥ 5 years ago |
| `FORMER_CLIENT` | former client, `SOLD` relationship or won status |
| `UNCONTACTED_LEAD` | prospect/valuation/seller created ≥ 3 months ago with no recorded contact, or dormant prospect |

A contact gets at most one open LeadRevive opportunity; recently closed ones (180 days) are not re-opened. Opportunities are auto-assigned to the contact's agent and scored with the LeadRevive profile (relationship 55 %, dormancy timing 25 %, territory 10 %, data completeness 10 %).

These are **signals of dormancy, not proof of intent** — the UI says so, and the score is capped well below market-signal opportunities unless a market event also matches.

## Screen

`/leadrevive` shows the six categories with counts, and a table with score, relationship score, last interaction, assigned agent, reason surfaced and the actions Assign · Review · Snooze · Dismiss · Mark contacted.
