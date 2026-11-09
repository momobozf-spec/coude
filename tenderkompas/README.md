# TenderKompas IT — pilot v0.1

Gecontroleerde selectie van openbare opdrachten voor kleine Belgische data- en cloudbureaus.
Keten: **bedrijfsprofiel → broninvoer → extractie → beoordeling → menselijke controle → publicatie in klantportaal → e-mailselectie → feedback.**

**Begin hier:** [docs/VALIDATIE.md](docs/VALIDATIE.md) (wat bewezen is, wat onzeker is, wat jij moet doen) · [docs/OVERDRACHT.md](docs/OVERDRACHT.md) (hosting, scheduler, back-up/herstel) · [docs/STATUS.md](docs/STATUS.md) · [docs/BRONNEN.md](docs/BRONNEN.md) · [docs/TESTRESULTATEN.md](docs/TESTRESULTATEN.md) · [docs/KOSTEN.md](docs/KOSTEN.md) · [PLAN.md](PLAN.md)

## Lokaal reviewen (5 minuten)
```bash
npm install
cp .env.example .env                       # DATABASE_URL + BETTER_AUTH_SECRET invullen
createdb tenderkompas && npm run db:migrate
ALLOW_DEMO_DATA=true npm run demo:seed     # herkenbaar fictieve demo, NOOIT in productie
npm run build && npm start                 # http://localhost:3000
```
- Klantdashboard + detail: `demo-klant@tenderkompas.test` / `demo-wachtwoord-123` → Kansen
- Beheerderreview + digest: `demo-beheer@tenderkompas.test` / `demo-wachtwoord-123` → Reviews, Digests
- E-mail zonder echte verzending: `node scripts/smtp-sink.mjs 2525` en start met `SMTP_HOST=127.0.0.1 SMTP_PORT=2525`
- Screenshots van deze schermen: `demo-output/1-klantdashboard.png` … `5-echte-bron-zorgband.png`

## Stack
Next.js 16.4.3 (App Router) · React 19.3 · TypeScript · Tailwind 4 · Zod 4 · PostgreSQL 16 · Drizzle ORM 0.45 (+ drizzle-kit migraties) · better-auth 1.7 · @anthropic-ai/sdk 1.1 (optioneel) · unpdf · nodemailer (optioneel) · Vitest 5.

> Afwijking van de voorkeur: **Drizzle i.p.v. Prisma.** Prisma 7 moet zijn native schema-engine downloaden van `binaries.prisma.sh`, wat in de bouwomgeving geblokkeerd was; zonder die engine geen migraties. Drizzle is pure TypeScript en de migraties zijn hier echt uitgevoerd en getest.

## Installatie
Vereist: Node ≥ 20.9, PostgreSQL ≥ 14.

```bash
npm install
cp .env.example .env            # vul DATABASE_URL en BETTER_AUTH_SECRET in (openssl rand -base64 32)
createdb tenderkompas            # of via je eigen Postgres-beheer
npm run db:migrate               # past drizzle/0000_init.sql toe
npm run admin:create -- --email jij@bedrijf.be --name "Jouw naam"   # vraagt het wachtwoord
npm run build && npm start       # of: npm run dev
```
Open http://localhost:3000 → Aanmelden.

### Optioneel
- **Demo met herkenbaar fictieve gegevens:** `ALLOW_DEMO_DATA=true npm run demo:seed` → accounts `demo-beheer@tenderkompas.test` en `demo-klant@tenderkompas.test` (wachtwoord `DEMO_PASSWORD`, standaard `demo-wachtwoord-123`). Demo-organisaties zien uitsluitend demo-opdrachten.
- **End-to-end demo met echte bronnen:** `ALLOW_DEMO_DATA=true npm run demo:e2e` (zie docs/STATUS.md). Verstuurt geen e-mail.
- **TED-import:** `node scripts/ted-live-check.mjs` (eerst, zonder DB) of `npm run ted:verify-fields`, daarna `npm run ted:import` (incrementeel; geschikt voor cron) of `npm run ted:sample` (90 dagen + steekproefrapport).
- **AI-extractie:** zet `ANTHROPIC_API_KEY` (+ tarieven `AI_PRICE_*` voor kostenregistratie). Zonder sleutel blijft alles handmatig werken.
- **E-mail:** zet `SMTP_*`. Zonder SMTP: preview/export, status “niet ingesteld”. Status “aanvaard door SMTP” is geen bevestigde aflevering.

## Live zetten (Render, EU/Frankfurt)

Bestanden: `Dockerfile`, `.dockerignore`, `render.yaml` (web + PostgreSQL 16 + dagelijkse cron `ted:import`, alles in regio Frankfurt), health check `GET /api/health`.

1. Render-account → **New → Blueprint** → kies de repo → Blueprint path `tenderkompas/render.yaml`. Render maakt aan: web service `tenderkompas` (Docker, starter, 1 GB disk op `/app/storage`), cron job `tenderkompas-ted-import` (dagelijks 04:15 UTC) en database `tenderkompas-db`.
2. Vul de `sync: false`-variabelen in: `BETTER_AUTH_URL` (`https://<jouw-domein>`), `LEGAL_ENTITY_ADDRESS` (straat + nr + postcode zetel), `SMTP_HOST/USER/PASSWORD/FROM` (EU-provider, eigen domein met SPF/DKIM), optioneel `ANTHROPIC_API_KEY`. `BETTER_AUTH_SECRET` genereert Render zelf.
3. Deploy. Bij elke deploy draait eerst `npm run db:migrate:prod` (preDeployCommand). Daarna Render-shell van de web service: `npm run admin:create -- --email jij@domein.be --name "Mohamed Bouzouf"` (wachtwoord wordt gevraagd).
4. Custom domain koppelen (Settings → Custom Domains) en `BETTER_AUTH_URL` gelijkzetten.
5. Controle: `https://<domein>/api/health` → `{"status":"ok","db":"ok"}`; `/voorwaarden` en `/privacy` tonen het volledige adres.
6. Back-up: Render maakt dagelijkse snapshots van de database; de documentmap (`/app/storage`) zit op de disk (Render maakt daar ook snapshots van). Zie docs/OVERDRACHT.md voor manuele dumps.

**Productie-guard** (`src/lib/production-guard.ts`, uitgevoerd via `src/instrumentation.ts`): met `NODE_ENV=production` weigert de server te starten bij o.a. lokale/standaard DB-wachtwoorden, een ontbrekend/kort `BETTER_AUTH_SECRET`, een niet-https `BETTER_AUTH_URL`, `ALLOW_DEMO_DATA=true`, `DEMO_PASSWORD`/`ADMIN_PASSWORD` in de omgeving, test-SMTP-instellingen, of bestaande demo-accounts (`@tenderkompas.test`). `APP_ENV=staging` zet de guard uit voor een testomgeving.

Zonder Render: elke host met Docker + PostgreSQL ≥ 14 werkt (`docker build -t tenderkompas .`, `docker run -e DATABASE_URL=… -e BETTER_AUTH_SECRET=… -e BETTER_AUTH_URL=… -v tk-storage:/app/storage -p 3000:3000 tenderkompas`, cron: `docker run … tenderkompas npm run ted:import`).

## Wettelijk
Uitbater: Marhaba Data & AI Agent BV, BE 1003.552.102, Zaventem (adres via `LEGAL_ENTITY_ADDRESS`). Pagina's `/voorwaarden` (B2B-voorwaarden incl. verwerkersclausule art. 28 AVG) en `/privacy`, gelinkt in elke footer en bij het aanvraagformulier. Concept — laten nalezen door een jurist.

## Tests
```bash
createdb tenderkompas_test       # TEST_DATABASE_URL; wordt bij elke run leeggemaakt en gemigreerd
npm test                         # 82 tests: unit + integratie tegen echte Postgres en lokale SMTP
npm run typecheck && npm run lint
```

## Structuur
```
src/db/schema.ts               datamodel (gedeelde publieke laag ↔ klantlaag)
src/lib/domain/                pure logica: beoordelingsengine, levensfase, vingerafdruk, publicatiepoort, digest
src/lib/services/              databasebewerkingen (procedures, beoordelingen, klant, digests, documenten, retentie)
src/lib/ted/                   TED Search API v3: veldenlijst, query, client (retries/iteratie), mapping, importer, steekproef
src/lib/ai/                    extractieschema, prompt, bewijscontrole
src/lib/net/safe-fetch.ts      SSRF-veilige documentophaling
src/app/                       landing, login, /admin (beheer), /portal (klant), API-routes
scripts/                       admin-create, demo-seed, demo-e2e, ted
tests/                         unit + integratie
drizzle/                       SQL-migraties
```

## Kernprincipes (afgedwongen in code én tests)
- “Onbekend” wordt nooit stil “voldaan”; suggesties worden nooit automatisch toegepast.
- Harde blokkade wint altijd van de relevantiescore; score is nooit een winkans.
- Vooraankondiging, gunning, intrekking en verlopen deadline ≠ open kans.
- Alleen goedgekeurde, actuele beoordelingen worden gepubliceerd; bronwijziging ⇒ nieuwe versie ter controle + banner bij de gepubliceerde versie.
- Raamovereenkomstplafond wordt nooit als omzet geïnterpreteerd. Deadlines: bronwaarde bewaard, tijdzone nooit geraden, weergave Europe/Brussels.
- Klantisolatie server-side; organisatie komt uit de sessie, nooit uit het formulier.
- Demo- en live gegevens kunnen technisch niet gemengd worden.
