# Privacy & data protection

ImmoRadar processes personal data of CRM contacts (tenant data) and of private sellers (market data). The following controls are implemented.

| Control | Implementation |
| --- | --- |
| Tenant isolation | Every CRM/opportunity/alert/territory query is scoped by the session-derived `agencyId`; cross-tenant access yields 403/404; automated tests in `tests/integration/tenant-isolation.test.ts`. CRM data of one tenant is never used to enrich another. |
| Data minimisation | Only the CRM fields needed for matching and prioritisation are stored; notes are optional; opportunity signals reference ids, not personal data. |
| Source provenance | `Listing.sourceId/sourceUrl`, `ListingSnapshot.rawData`, `CollectorRun` per fetch. |
| Import provenance | `CrmImport` + `CrmImportRow.rawData/conflicts`, `CrmContact.sourceValues/importId`. |
| Configurable retention | `Agency.crmRetentionDays`; `jobs:retention` soft-deletes untouched contacts without open opportunities. |
| Deletion workflow | *Contact → Delete & erase personal data* nulls name/email/phone/address/notes/source values, deletes interactions and relationships, dismisses open opportunities, keeps an anonymised row for referential integrity and writes an audit entry. |
| Audit logging | `AuditLog` for login, imports, workflow actions, settings, territory changes, admin actions (ids only). |
| Safe logging | JSON logger redacts `email`, `phone`, `notes`, `token`, `password`, chat ids, etc. Alerts never log recipients. |
| Secrets | Validated via Zod from environment; never committed (`.env` ignored, `.env.example` provided). |
| Role-based access | `PLATFORM_ADMIN` / `AGENCY_ADMIN` / `AGENT` permission matrix; agents cannot import/delete CRM data or change settings. |
| Sessions | HttpOnly, SameSite=Lax, secure cookies; token hashed at rest; expiry purge in the retention job. |
| Lawful collection | Collectors only for sources with permitted access; no bypass of CAPTCHA/login/anti-bot/rate limits; fixture collectors for demo. |

Recommended organisational measures: document the legal basis (legitimate interest for B2B acquisition, contract for CRM processing on behalf of the agency), sign a processor agreement with each agency, and honour data-subject requests through the deletion workflow.
