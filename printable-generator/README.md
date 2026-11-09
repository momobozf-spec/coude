# Noor Printables (printable-generator)

Islamitische werkbladen (kleurplaten, doolhoven, woordzoekers) als PDF + digitaal kleuren, voor ouders,
leerkrachten en (weekend)scholen. Uitbater: **Marhaba Data & AI Agent BV** (BE 1003.552.102, Zaventem).

**Kern (standaard aan):** generator + login (e-mail/wachtwoord, optioneel Google/Microsoft/Apple) +
Stripe-abonnement Pro/School (maand/jaar) + juridische pagina's.

**Optionele modules (standaard UIT, feature flags):** marktplaats, academy, kleurboeken (Printful),
white-label, games/leaderboard, community (Circle), Ramadan-challenge. Aanzetten met
`NEXT_PUBLIC_FEATURE_<NAAM>=true` + rebuild. Uitgeschakelde modules geven 404 (pagina's én API's, via
`src/proxy.ts`) en verdwijnen uit navigatie, footer en sitemap.

Stack: Next.js 16.4 (App Router), React 19, Auth.js v5 (beta.32), Prisma 7 + libsql (SQLite lokaal / Turso
in productie), Stripe, Resend, pdfkit.

## Lokaal draaien

```bash
npm install                      # draait ook `prisma generate`
cp .env.example .env.local       # vul AUTH_SECRET in (npx auth secret)
npm run db:migrate               # past prisma/migrations toe op DATABASE_URL
npm run dev
```

Admin worden: registreer je, dan `npm run admin:set-role -- jij@voorbeeld.be admin`. Admin-rechten komen
uitsluitend uit `users.role` in de database (geen gedeeld wachtwoord meer). `/admin` toont statistieken.

## Kwaliteit

```bash
npm run typecheck   # tsc
npm run lint        # eslint (0 errors)
npm test            # vitest — 37 tests, elk testbestand krijgt een eigen SQLite-db met alle migraties
npm run build
```

Tests dekken: admin-rolcheck, geen `fileUrl` in publieke marktplaats-API, signed downloads (token, limiet,
SSRF-allowlist), referral-claim (login vereist, idempotent, parallel), Printful-webhook (token + order-id-check),
Stripe-webhook (signatuur, idempotentie, async betalingen, onbekende prijs, downgrade, retry bij fout),
feature flags/proxy, productie-guard, registratie-toestemming en EUR-prijsweergave.

## Betalingen (Stripe)

- `POST /api/stripe/checkout` → Stripe Checkout (abonnement), betaalmethodes beheer je in het Stripe-dashboard
  (Bancontact, kaart, iDEAL, SEPA). Optioneel Stripe Tax via `STRIPE_AUTOMATIC_TAX=true`.
- `POST /api/stripe/portal` → klantenportaal (opzeggen, kaart wijzigen, facturen).
- `POST /api/webhooks/stripe` → signatuurcontrole, idempotentie (tabel `processed_webhook_events`), plan wordt
  bepaald door de Stripe-prijs. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
  (`/api/stripe/webhook` is een alias.)

**Aan te maken in Stripe** (eerst in test mode, daarna live):

| Product | Prijs (recurring, EUR, incl. btw) | Env-var |
|---|---|---|
| Noor Pro | maandelijks — bedrag te bevestigen (nu getoond: 12) | `STRIPE_PRO_MONTHLY_PRICE_ID` |
| Noor Pro | jaarlijks — te bevestigen (97) | `STRIPE_PRO_YEARLY_PRICE_ID` |
| Noor School | maandelijks — te bevestigen (49) | `STRIPE_SCHOOL_MONTHLY_PRICE_ID` |
| Noor School | jaarlijks — te bevestigen (397) | `STRIPE_SCHOOL_YEARLY_PRICE_ID` |

De getoonde bedragen komen uit `NEXT_PUBLIC_PRICE_*` (valuta `NEXT_PUBLIC_PRICE_CURRENCY`, standaard EUR) en
moeten gelijk zijn aan de Stripe-prijzen. Zolang `NEXT_PUBLIC_PRICES_CONFIRMED` niet `true` is, staat overal
"(te bevestigen)".

## Live zetten (Vercel + Turso, EU)

1. **Database (Turso):** maak een database in regio Frankfurt/Amsterdam (`turso db create noor --location fra`),
   haal URL + token op (`turso db show noor --url`, `turso db tokens create noor`). Migreer vanaf je laptop:
   `DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate`.
2. **Stripe:** maak de 4 prijzen hierboven, activeer klantenportaal (opzeggen toestaan), betaalmethodes
   (Bancontact, kaart), eventueel Stripe Tax. Webhook-endpoint: `https://<domein>/api/webhooks/stripe` met de 5
   events hierboven → kopieer de signing secret naar `STRIPE_WEBHOOK_SECRET`.
3. **Vercel:** importeer de repo, Root Directory `printable-generator`, Framework Next.js, Functions region
   `fra1` (Settings → Functions). Zet alle env-vars uit `.env.example` (minstens: `AUTH_SECRET`,
   `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, alle `STRIPE_*`, `NEXT_PUBLIC_PRICE_*`,
   `NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS`). Zonder deze weigert de app te starten (productie-guard).
4. **E-mail (optioneel maar aangeraden):** Resend-account, domein verifiëren, `RESEND_API_KEY` + `EMAIL_FROM`.
5. **Domein:** koppel in Vercel, zet `NEXT_PUBLIC_APP_URL` op `https://<domein>` en redeploy.
6. **Admin:** registreer je op de live site en voer `npm run admin:set-role -- <email> admin` uit met de
   Turso-env-vars.
7. **Controle:** registreren (vinkje 18+/voorwaarden), werkblad genereren, upgrade met testkaart in test mode,
   webhook ziet `200`, plan wordt `pro`; `/privacy`, `/terms`, `/cookies`, `/legal` nalezen.

## Juridisch

`/privacy`, `/terms` (incl. herroepingsrecht + modelformulier), `/cookies`, `/legal` — in NL (leidend), FR, EN,
DE (`src/legal/*.ts`). Status: **Concept — laten nalezen door een jurist.** Kinderen: accounts alleen voor
18+ (ouder/voogd/leerkracht), geen kindgegevens in de kern (GDPR art. 8 / Belgische leeftijdsgrens 13 jaar).
Cookiebanner: Google Analytics laadt alleen na toestemming. Adres maatschappelijke zetel:
`NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS` (TODO).
