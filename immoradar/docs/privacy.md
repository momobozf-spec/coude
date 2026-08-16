# Privacy & data protection

CRM data is personal data. ImmoRadar treats it accordingly.

## Tenant isolation

- Every CRM/opportunity/territory/alert/import row carries `agencyId`; all access
  goes through `TenantDb`, which injects the tenant filter into every query.
- One agency's CRM data is **never** used to enrich another agency's intelligence:
  CRM ↔ market matching executes inside the processing agency's tenant handle.
- Covered by dedicated automated tests (`tests/tenant-isolation.test.ts`), including
  the cross-enrichment case.

## Data minimization

- Only the CRM fields needed for matching and prioritization are imported.
- Normalized match keys (phone/email/name) exist solely to support dedupe and
  CRM ↔ market matching.
- The UI shows contact details only inside the owning agency's session.

## Retention & deletion

- `Agency.crmRetentionDays` configures CRM retention (null = keep until deleted).
- Contact deletion (`TenantDb.deleteCrmContact`) cascades to interactions, property
  relationships and import-row links; opportunities lose the contact reference
  (`SetNull`) rather than leaking data.
- Deleting an agency cascades to all tenant-owned rows.

## Provenance & audit

- Every listing snapshot retains the original source payload (`rawData`) — market
  data provenance.
- Every CRM import retains per-row raw data and outcome — import provenance;
  nothing is silently overwritten.
- `AuditLog` records logins, imports, opportunity status changes and settings
  changes with actor and tenant.

## Secrets & logging

- Secrets come exclusively from environment variables (`SESSION_SECRET`,
  `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`); nothing is hardcoded.
- The structured logger (`src/lib/logger.ts`) redacts known-sensitive keys
  (names, phones, emails, notes, passwords, tokens) as defense in depth; services
  log IDs and counts, not contact PII.
- Login failures are logged without the local part of the email address.

## Access control

- Roles: `PLATFORM_ADMIN` (platform screens; sees tenant *counts*, never tenant CRM
  content), `AGENCY_ADMIN` (settings, territories, imports), `AGENT` (work
  opportunities).
- Sessions: httpOnly SameSite=Lax cookies signed with HMAC-SHA256, 7-day expiry.
- All mutations are Zod-validated server actions with role checks.
