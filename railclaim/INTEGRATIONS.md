# Integrations

Status of every external dependency. **Nothing listed as CONFIGURATION REQUIRED
is mocked** — the code is written and exercised, it simply refuses to run
without credentials rather than faking a result.

Legend:

- **LIVE** — working now, no action needed.
- **CONFIGURATION REQUIRED** — fully implemented; needs credentials from you.
- **NOT AVAILABLE** — deliberately not built, with the reason.

| Integration | Status | What you must supply |
|---|---|---|
| iRail API | **LIVE** | Nothing. Open data, no key. Set `IRAIL_CONTACT_EMAIL` to a real mailbox (fair-use requirement). |
| Supabase (Postgres, Auth, Storage) | **CONFIGURATION REQUIRED** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Field encryption | **CONFIGURATION REQUIRED** | `ENCRYPTION_KEY` (32 bytes, base64) |
| Stripe (Billing + Checkout, Bancontact) | **CONFIGURATION REQUIRED** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Resend (transactional e-mail) | **CONFIGURATION REQUIRED** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Sentry | **CONFIGURATION REQUIRED** | `SENTRY_DSN` |
| Submission to NMBS | **NOT AVAILABLE** | No public API or e-mail channel exists. See [ADR 0001](docs/decisions/0001-indieningskanaal.md). The product ships guided submission instead. |

---

## iRail — LIVE

No credentials. Verified working against the live API on 2026-08-29.

**Your one obligation:** `IRAIL_CONTACT_EMAIL` must be a mailbox you actually
read. It goes into the `User-Agent` header. iRail's policy is that they contact
you before blocking an IP *if* you identify yourself, and block without warning
if you do not. Our rate limiting (2 req/s against their 3 req/s ceiling) and
polling strategy are documented in [docs/irail.md](docs/irail.md).

## Supabase — CONFIGURATION REQUIRED

1. Create a project (region: `eu-central-1` or `eu-west-*` — the data is
   Belgian personal data and should stay in the EU).
2. Apply the migrations in `supabase/migrations/` in filename order.
3. Seed the verified compensation rules — **this step is not optional**:
   ```
   npm run db:seed
   ```
   Without it the detection engine refuses to evaluate any trip, by design.
4. Create a **private** Storage bucket named `claim-pdfs`. Do not make it public;
   dossiers are served through short-lived signed URLs.
5. Add yourself to `admin_users` to reach the admin area:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'you@example.be';
   ```

## Field encryption — CONFIGURATION REQUIRED

```
openssl rand -base64 32
```

Store it in your secret manager, not in the repository. **If this key is lost,
every stored IBAN and MoBIB number is unrecoverable** — they are encrypted with
it (see [ADR 0003](docs/decisions/0003-encryptie-gevoelige-velden.md)). Rotation
is possible: the envelope carries a `v1:` prefix so a rotation script can read
both generations during a migration.

## Stripe — CONFIGURATION REQUIRED

Two products:

- **Pendel Pro** — EUR 3,99/month, recurring (Billing)
- **Pay-per-claim** — EUR 5,99 one-off (Checkout)

Prices are admin-configurable in `app_settings`; the Stripe price IDs are stored
there rather than hardcoded.

**Enable Bancontact** in Dashboard -> Settings -> Payment methods, alongside
card. It is the dominant consumer payment method in Belgium and the checkout is
configured to offer it.

Webhook endpoint: `POST {APP_URL}/api/stripe/webhook`. Signature verification is
mandatory and events are recorded in `stripe_events` for idempotency, so a
replayed webhook cannot double-grant entitlement.

## Resend — CONFIGURATION REQUIRED

Used for: delay-detected notifications, confirmation reminders before a
deadline, and claim status updates. Verify your sending domain (SPF + DKIM)
before going live, otherwise deadline reminders land in spam — and a missed
reminder costs the user a claim.

## Sentry — CONFIGURATION REQUIRED

`beforeSend` scrubs IBANs and long digit runs before anything leaves the process
(`scrubText` in `src/lib/logger.ts`). Verify this still holds after any Sentry
SDK upgrade.

## Submission to NMBS — NOT AVAILABLE

Researched in Phase 0. NMBS accepts compensation requests through My NMBS
(behind the user's personal login), at a counter, or by post — and the postal
route requires the **original** ticket except for MoBIB subscriptions. There is
no API and no documented e-mail channel.

We therefore do **not** submit on the user's behalf, and we never ask for My
NMBS credentials. The product prepares the complete dossier and the user files
it. The architecture keeps a `SubmissionChannel` interface so an official
channel can be plugged in later without touching the claim pipeline. Full
reasoning: [ADR 0001](docs/decisions/0001-indieningskanaal.md).
