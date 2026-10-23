# Layali — Oriental Lifestyle webshop

Webshop voor België en Nederland: theeglazen, lantaarns, geurkaarsen, home
fragrance, decoratie en cadeaus. NL/FR, betalen via Mollie.

> De projectmap heet historisch `jamal-jamila/`; de merknaam is **Layali**.

## Wat erin zit

- Catalogus met categorieën, filters, varianten (kleur/geur/materiaal) en SEO
- Winkelmand, kortingscodes, verzendkosten (gratis vanaf € 75)
- Afrekenen via **Mollie**; de bestelling en de voorraadreservering ontstaan
  vóór de betaling, de webhook bevestigt
- Accounts (e-mail + wachtwoord, optioneel Google), wachtwoord vergeten en wijzigen
- Beheer: producten, bestellingen (status, track & trace), CSV-import
- Transactionele e-mails via Resend
- Marktplaatsmodule (verkopers en diensten) — zie de kanttekening onderaan

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 op
PostgreSQL (pg-driver) · NextAuth 4 · next-intl · Zod · Vitest

Uitbater: **Marhaba Data & AI Agent BV** (BE 1003.552.102, Zaventem) — zie
`src/lib/legal.ts`.

## Lokaal starten

```bash
npm install
cp .env.example .env          # DATABASE_URL en NEXTAUTH_SECRET invullen
npx prisma migrate deploy     # schema op een lege PostgreSQL
npm run db:reference          # categorieën
npm run db:seed:demo          # optioneel: demo-catalogus
BOOTSTRAP_ADMIN_EMAIL=jij@voorbeeld.be npm run bootstrap:admin
npm run dev
```

## Controleren

```bash
npm run typecheck && npm run lint
TEST_DATABASE_URL=postgresql://…/layali_test npm test   # unit + integratie
```

De integratietests draaien tegen een echte PostgreSQL met de migraties
toegepast; zonder `TEST_DATABASE_URL` worden ze overgeslagen.

## Hoe een bestelling loopt

1. `POST /api/checkout/mollie`: invoer gevalideerd (Zod), alles opnieuw geprijsd
   aan serverkant in centen, voorraad atomair gereserveerd
   (`stock >= gevraagd`), ordernummer uit een Postgres-sequence.
2. Mollie-betaling aangemaakt; mislukt dat, dan komt de voorraad meteen terug.
3. `POST /api/webhooks/mollie`: status opgevraagd bij Mollie (nooit uit het
   verzoek) → betaald, of geannuleerd met voorraad terug. Idempotent.
4. Vangnet: `POST /api/cron/reconcile` (elk uur via GitHub Actions) controleert
   openstaande bestellingen ouder dan een half uur.
5. Afwijkingen (ander bedrag betaald, betaald na verlopen terwijl de voorraad
   op is, geannuleerd na betaling) krijgen een notitie in `needsAttention`.

## Live zetten

Layali heeft PostgreSQL nodig en draait als Docker-container: **Render**
(regio Frankfurt) + **Neon** (Postgres, Frankfurt). Gratis testopstelling:
[docs/DEPLOY-RENDER-FREE.md](docs/DEPLOY-RENDER-FREE.md). Voor de echte winkel:

1. **Neon**: project in *AWS Europe Central 1 (Frankfurt)*, Postgres 17; een
   betaald plan met point-in-time restore. Kopieer de connection string.
2. **Mollie**: account op naam van Marhaba Data & AI Agent BV, verificatie
   afronden, betaalmethodes activeren (Bancontact, iDEAL, kaarten). Mollie werkt
   zonder producten of prijzen: de webshop stuurt per bestelling het bedrag mee.
   De webhook-URL (`https://<domein>/api/webhooks/mollie`) wordt per betaling
   meegegeven; in het Mollie-dashboard hoef je niets in te stellen.
3. **Resend**: domein toevoegen en SPF/DKIM-records zetten bij je registrar.
4. **Render**: New → Blueprint → `render.free.yaml` als basis, maar met een
   betaald plan, zonder `STAGING`, `SEED_DEMO=0` en de env-vars hieronder.
   Eigen domein koppelen (Settings → Custom Domains); https is automatisch.
5. Eerste beheerder: `BOOTSTRAP_ADMIN_EMAIL` zetten, tijdelijk wachtwoord uit de
   logs halen, inloggen, wachtwoord wijzigen, variabele weer verwijderen.
6. **GitHub Actions**: `deploy/github-cron.yml` → `.github/workflows/cron.yml`,
   secrets `APP_URL` en `CRON_SECRET` (vangnet voor gemiste webhooks).
7. Uptime-monitor op `/api/ready` (controleert ook de database); `/api/health`
   is de lichte liveness-check.

### Omgevingsvariabelen (productie)

| Variabele | Verplicht | Wat |
| --- | --- | --- |
| `DATABASE_URL` | ja | Neon-connection string |
| `APP_URL`, `NEXTAUTH_URL` | ja | `https://jouwdomein.be` (beide gelijk, https) |
| `NEXTAUTH_SECRET` | ja | `openssl rand -base64 32` |
| `MOLLIE_API_KEY` | ja | `live_…` (een `test_…`-sleutel alleen met `STAGING=1`) |
| `RESEND_API_KEY`, `RESEND_FROM` | ja | `Layali <bestellingen@jouwdomein.be>` |
| `ADMIN_EMAIL`, `SUPPORT_EMAIL` | ja | meldingen van bestellingen / klantendienst |
| `LEGAL_ENTITY_ADDRESS` | ja | straat, nr, postcode van de zetel (TODO) |
| `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_VAT`, `LEGAL_CONTACT_EMAIL` | nee | standaard de BV-gegevens |
| `RETURN_COSTS_PAID_BY` | nee | `customer` (standaard) of `seller` |
| `LEGAL_TEXTS_REVIEWED` | nee | `1` na juridische nalezing |
| `CRON_SECRET` | aanbevolen | ≥ 32 tekens, voor `/api/cron/reconcile` |
| `TRUSTED_PROXY_HOPS` | nee | Render: `1` |
| `GOOGLE_CLIENT_ID/SECRET` | nee | Google-login |
| `NEXT_PUBLIC_GA_ID`, `…META_PIXEL_ID`, `…TIKTOK_PIXEL_ID` | nee | laden pas na cookietoestemming |

De app **weigert te starten** in productie bij: ontbrekende database, kort of
voorbeeld-`NEXTAUTH_SECRET`, geen https, `APP_URL` ≠ `NEXTAUTH_URL`,
`MOLLIE_API_URL` gezet, een Mollie-testsleutel of `SEED_DEMO=1` zonder
`STAGING=1`. Er bestaan geen standaardwachtwoorden: de eerste beheerder krijgt
een willekeurig tijdelijk wachtwoord.

## Vóór je echt verkoopt

Zie [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).
