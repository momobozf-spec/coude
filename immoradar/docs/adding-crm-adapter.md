# Adding a CRM adapter

LeadRevive consumes contacts through the `CrmAdapter` interface (`src/crm/adapters/crm-adapter.ts`):

```ts
interface CrmAdapter {
  readonly key: string;            // "csv", "whise", "omnicasa"
  readonly name: string;
  importContacts(): Promise<CrmContactInput[]>;
  pushOpportunity?(opportunity: OpportunityForCrm): Promise<void>;   // optional write-back
}
```

`CrmContactInput` (`src/domain/contact/types.ts`) is the canonical shape: identifiers, name, email, phone, address, assigned agent, `contactType`, `status`, `createdAt`, `lastContactAt`, notes, an optional property-relationship hint and `sourceValues` for provenance.

## Steps

1. **Use only documented APIs** of the CRM vendor, with credentials owned by the agency. Do not implement undocumented endpoints.
2. Create `src/crm/adapters/<vendor>-adapter.ts` implementing `CrmAdapter`. Map vendor fields to `CrmContactInput`; use `mapContactType()` / `mapStatus()` from the CSV adapter when the vocabularies overlap, and keep the vendor's raw record in `sourceValues`.
3. Store credentials per agency (add a settings model or encrypted JSON column; never in code or logs).
4. Call `importContacts(db, ctx, adapter, { fileName: "whise-sync" })` from a job or action — normalization, deduplication, conflict handling, provenance and dormant detection are shared.
5. Optionally implement `pushOpportunity()` to write opportunities back into the CRM once they reach a status such as `INTERESTED`.
6. Add tests with recorded fixture payloads (no network in tests).

The CSV adapter (`CsvCrmAdapter`) is the reference implementation.
