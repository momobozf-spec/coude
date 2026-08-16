# Adding a CRM adapter

LeadRevive imports CRM contacts through the `CrmAdapter` interface
(`src/crm/adapter.ts`):

```ts
interface CrmAdapter {
  readonly code: string;                                  // "csv" | "whise" | "omnicasa"
  importContacts(): Promise<NormalizedCrmContact[]>;
  pushOpportunity?(opportunity: CrmAdapterOpportunitySummary): Promise<void>;
}
```

The MVP ships `CsvCrmAdapter`. API adapters (Whise, Omnicasa, …) plug in behind the
same interface later.

## Rules

- **Documented APIs only.** Never implement an undocumented or reverse-engineered
  API. Use the vendor's official, documented integration method with proper
  credentials granted by the agency.
- Credentials belong in per-agency configuration, delivered via environment/secret
  storage — never in code.
- The adapter's job is **fetch + map to `NormalizedCrmContact`**. Reuse the
  normalizers in `src/normalization/normalizers.ts` and the alias tables in
  `src/crm/contact-normalizer.ts` — do not duplicate normalization logic.
- Deduplication, conflict handling and provenance are owned by
  `CrmImportService` — adapters must not write to the database directly.

## Steps

1. Create `src/crm/<vendor>-adapter.ts` implementing `CrmAdapter`.
2. Map vendor fields → `NormalizedCrmContact` (set `externalContactId` to the
   vendor's stable contact ID — it drives idempotent re-imports).
3. Extend `CrmImportService` with an entry point that takes an adapter instead of
   CSV content (the row-provenance path is reusable; record the adapter code on
   the `CrmImport`).
4. Add fixture-based tests: sample API payloads → expected normalized contacts →
   dedupe behavior on re-import.
5. Optional: implement `pushOpportunity` to write qualified opportunities back into
   the source CRM (again: documented endpoints only).

## Field mapping reference

`NormalizedCrmContact` fields: `externalContactId`, `firstName`, `lastName`,
`normalizedName`, `email`/`normalizedEmail`, `phone`/`normalizedPhone` (E.164 +32),
`address`, `postalCode`, `city`, `assignedAgentName`, `contactType`
(BUYER/SELLER/LANDLORD/TENANT/VALUATION_LEAD/PROSPECT/FORMER_CLIENT/UNKNOWN),
`leadType`, `status`, `sourceCreatedAt`, `lastContactAt`, `notes`.
