# Superette — Belgische supermarktvergelijker

Prijzen van Belgische supermarkten naast elkaar: productzoeken, eenheidsprijzen
per kg/l/stuk, productmatching, boodschappenlijsten, mandje-vergelijking en
prijsalerts. App in `apps/superette-web` (nl/fr/en), API in `apps/api`
(`src/compare/*`). Uitbater: **Marhaba Data & AI Agent BV** (BE 1003.552.102,
Zaventem). Zie **[docs/COMPARE.md](docs/COMPARE.md)** en hieronder
**[Live zetten (Superette)](#live-zetten-superette)**.

> **Productie = alleen de vergelijker.** Dezelfde monorepo bevat ook de
> onbemande boetiek **Jamal & Jamila** (toegangscontrole, self-scanning,
> Belgische kasbonnen; `apps/pwa`, `sim/gate`, MQTT). Die staat standaard
> **uit** (`BOUTIQUE_ENABLED=false`, ook in productie): de modules en routes
> worden niet geladen (404) en MQTT start niet. De code blijft; de
> boetiekdocumentatie staat verderop in dit bestand.

```
superette/
├── apps/
│   ├── api/          NestJS · Prisma · PostgreSQL
│   │   └── src/compare/   supermarktvergelijker (adapters, matching, mandje, alerts)
│   ├── pwa/          Jamal & Jamila klant-app · Next.js PWA · Tailwind · nl/fr
│   └── superette-web/  Superette-app · Next.js PWA · Tailwind · nl/fr/en · :3001
├── packages/
│   ├── contracts/    Zod-schema's, gedeeld tussen API en PWA
│   ├── pricing/      zuivere prijsnormalisatie (centen, eenheden, promoties, statiegeld)
│   └── vat/          Belgische BTW-berekening (6% / 21%)
├── sim/
│   └── gate/         MQTT-broker + deurcontroller-simulator
└── infra/            Mosquitto-config
```

## Snel starten

Zonder Docker, op Windows/macOS/Linux:

```bash
npm install
cp .env.example .env      # en vul JWT_SECRET in (npm run keys:gen)
npm run build

# Vergelijker (wat in productie draait)
npm run dev:db            # terminal 1 — embedded PostgreSQL op :5432
npm run db:migrate:deploy # schema aanmaken via migraties (zie docs/COMPARE.md § Migraties)
npm run db:seed:compare   # supermarktvergelijker: ketens op demogegevens (of je data/feeds)
npm run dev:api           # terminal 2 — API op :4000
npm run dev:web           # terminal 3 — Superette-app op :3001

# Boetiek (alleen lokaal, BOUTIQUE_ENABLED=true + gate-sleutels uit keys:gen in .env)
npm run db:seed           # demo-winkel + 8 producten + dev-device-sleutel (weigert in productie)
npm run dev:gate          # MQTT-broker + deurcontroller
npm run dev:pwa           # boetiek-app op :3000
```

Met Docker (de productieweg):

```bash
docker compose up -d      # Postgres + Mosquitto
```

Verifiëren dat alles klopt:

```bash
npm test              # 428 tests (vat 13 · pricing 61 · api 328 · web 26), incl. HTTP-integratietests (boetiekvlag, feed-push)
npm run smoke:gate    # 29 checks tegen de live API — replay, rotatie, vervalsing (BOUTIQUE_ENABLED=true)
npm run smoke:shop    # 35 checks — scannen, btw, webhook-idempotentie, factuurnummers (BOUTIQUE_ENABLED=true)
npm run smoke:compare # vergelijker — zoeken, lijsten, mandje, alerts, autorisatie (IDOR), validatie
npm run smoke:auth    # productiehardening — cookies, CSRF, CORS, sessies, export/verwijdering, jobs, rate limits
npm run walkthrough   # 31 checks in een echte browser + schermafbeeldingen
npm run walkthrough:superette  # Superette-app: verticale flow, responsive, axe-core, headers, sessieverloop
npm run db:migrate:test        # migraties: drift, lege database, bestaande data, rollback
npm run loadtest               # belasting: aantal, fouten %, mediaan, p95, p99
npm run check:bundle           # geen geheimen of tokens in de webbundel
```

Productie: `docs/PRODUCTION-READINESS.md` (checklist met bewijs),
`docs/DEPLOYMENT.md`, `docs/DATABASE.md`, `docs/SECURITY.md`,
`docs/MONITORING.md`, `docs/RUNBOOK.md`, `docs/PRIVACY.md`.

De rooktests hebben een draaiende API en database nodig; `walkthrough` ook de PWA.

> `/auth/register` staat op **5 pogingen per minuut per IP**. Draai je alle suites
> vlak achter elkaar, dan loopt de laatste tegen een `429` aan. Dat is de rate
> limiter die zijn werk doet — wacht een minuut, of verhoog de limiet lokaal.

`npm run walkthrough` loopt de volledige klantreis af in Chromium — registreren,
sleutel, deur, scannen, afrekenen, kasbon, uitgang — en zet schermafbeeldingen van
beide thema's in `docs/screenshots/`. Hij vond drie bugs die geen enkele unit-test
kon vinden: de aftelring stond náást de QR in plaats van eromheen, hij liep nooit
leeg (gedeeld door de verkeerde levensduur), en het bijschrift toonde de vervaltijd
onder het label "vernieuwt over".

## Live zetten (Superette)

Doel: API + app + Postgres + dagelijkse sync op **Render, regio Frankfurt (EU)**,
met de blueprint [`render.yaml`](render.yaml). De boetiek blijft uit. Niets
hiervan gebeurt vanzelf; jij beslist wanneer.

### 0. Vooraf (eenmalig, buiten de code)

1. **Domein** kopen en DNS kunnen beheren (bv. `superette.be`). Nodig: app en
   API moeten op één *site* staan voor de sessiecookies. Op twee
   `*.onrender.com`-adressen werkt inloggen niet (Public Suffix List).
2. **Adres van de BV**: straat, nummer, postcode, gemeente → `LEGAL_ENTITY_ADDRESS`.
   Zonder adres weigert de API te starten en faalt de web-build.
3. **Juridische teksten** (`/privacy`, `/voorwaarden`, `/cookies`, `/over-de-gegevens`)
   zijn een **concept**: laat ze nalezen door een jurist vóór de lancering.
4. **Databronnen**: alle feeds staan op `termsReviewed: false` → in de app
   "Niet geverifieerd". Of en wanneer een bron op `true` mag, is jouw
   juridische beslissing per keten (gebruiksvoorwaarden, databankrecht).
   Zet het nooit "om te testen" op `true`.

### 1. Blueprint aanmaken

Render-dashboard → **New → Blueprint** → repository `momobozf-spec/coude`,
branch `main`, **Blueprint Path** `superette-pro/render.yaml`.
(Ondersteunt je account geen ander pad: kopieer het bestand naar de root van de
repository; `rootDir: superette-pro` in de services blijft kloppen.)

Render maakt: `superette-db` (Postgres 16), `superette-api` (web, Node),
`superette-web` (web, Node), `superette-sync` (cron, dagelijks 04:17 UTC) en
twee env-groepen. Plannen in de blueprint: `starter` voor de services en
`basic-256mb` voor de database (betaald; kies zelf op de Render-prijspagina).

### 2. Env-vars die jij invult (`sync: false`)

| Waar | Variabele | Waarde |
|---|---|---|
| groep `superette-legal` | `LEGAL_ENTITY_ADDRESS` | bv. `Straat 1, 1930 Zaventem` (het echte adres) |
| groep `superette-api-shared` | `SUPERETTE_WEB_URL` | `https://superette.be` (exact de origin van de app) |
| `superette-web` | `NEXT_PUBLIC_API_URL` | `https://api.superette.be/api/v1` |
| `superette-api` en `superette-sync` (optioneel) | `EMAIL_FROM`, `EMAIL_HTTP_URL`, `EMAIL_API_KEY` | pas als je een e-mailprovider kiest, zie stap 6 |
| `superette-api` en `superette-sync` (optioneel) | `ERROR_REPORTING_DSN` | DSN van Sentry/GlitchTip (https) |

Door Render gegenereerd (niet zelf verzinnen): `JWT_SECRET`, `COMPARE_JOB_KEY`
(groep `superette-api-shared`), `DATABASE_URL` (uit de database).
Vast in de blueprint: `NODE_ENV=production`, `BOUTIQUE_ENABLED=false`,
`MQTT_ENABLED=false`, `TRUST_PROXY=1`, `COMPARE_ALLOW_DEMO=false`,
`EMAIL_PROVIDER=none`, `NOTIFY_EMAIL_ENABLED=false`.

De API weigert te starten in productie bij: demo aan, standaard-/zwakke
geheimen (plaatshouders, < 32 tekens jobsleutel, docker-compose-databasewachtwoord),
ontbrekend adres, http-URL's (app, e-mail, foutmonitoring), de dev-deurscanner
(`NEXT_PUBLIC_DEV_*`) of — met boetiek aan — de publieke dev-scannersleutel uit
`prisma/seed.ts`, een Mollie-testsleutel of MQTT zonder TLS.

### 3. Eerste deploy

`autoDeploy` staat uit. Klik per service **Manual Deploy**, in deze volgorde:
`superette-api` (voert eerst `prisma migrate deploy` uit als pre-deploy),
dan `superette-web`, dan `superette-sync` (één keer **Trigger Run** om te testen).

Controle:

```bash
curl https://api.superette.be/api/v1/health/live    # {"status":"ok"}
curl https://api.superette.be/api/v1/health/ready   # {"status":"ok","checks":{"database":"ok"}}
curl -H "x-job-key: <COMPARE_JOB_KEY>" https://api.superette.be/api/v1/health/status
curl -i -X POST https://api.superette.be/api/v1/gate/unlock   # 404: boetiek staat uit
```

### 4. Domeinen

`superette-web` → Settings → Custom Domains → `superette.be` (en eventueel
`www`); `superette-api` → `api.superette.be`. Zet de DNS-records die Render
toont; TLS regelt Render. Pas daarna `SUPERETTE_WEB_URL` en
`NEXT_PUBLIC_API_URL` definitief aan en deploy `superette-web` opnieuw
(de API-URL wordt bij de build ingebakken).

### 5. Prijzen aanleveren vanaf je laptop

De scrapers draaien lokaal (Playwright/Scrapling); de server heeft geen blijvende
schijf. Na `npm run weekly` of een losse scrape/import:

```bash
# in de root-.env op je laptop (wordt nooit gelogd):
#   PUSH_API_URL=https://api.superette.be/api/v1
#   PUSH_JOB_KEY=<COMPARE_JOB_KEY uit Render → superette-api-shared>
npm run feeds:push -- --dry-run   # alleen valideren
npm run feeds:push                # alle data/feeds/<keten>.json
npm run feeds:push -- delhaize    # één keten
```

Elke feed wordt lokaal gevalideerd (zelfde schema als de server), gzip-verstuurd
naar `POST /api/v1/compare/internal/feeds/:chain` (header `x-job-key`), in de
database bewaard en meteen gesynchroniseerd; de dagelijkse cron neemt hem ook
mee. `termsReviewed` blijft wat de feed zegt.

### 6. E-mail voor prijsalerts (optioneel)

Kies een EU-provider met een JSON-API en Bearer-sleutel, verifieer het
afzenderdomein (SPF/DKIM), sluit een verwerkersovereenkomst. Zet daarna in
`superette-api` én `superette-sync`: `EMAIL_PROVIDER=http`,
`EMAIL_HTTP_URL=https://…`, `EMAIL_API_KEY=…`,
`EMAIL_FROM="Superette <alerts@superette.be>"`, `NOTIFY_EMAIL_ENABLED=true`.
Elke mail vermeldt onderaan de BV, het ondernemingsnummer en het adres.

### 7. Sleutelrotatie

`COMPARE_JOB_KEY`: zet de oude waarde in `COMPARE_JOB_KEY_PREVIOUS`, een nieuwe
in `COMPARE_JOB_KEY`, deploy, werk `PUSH_JOB_KEY` op je laptop bij, maak
`_PREVIOUS` leeg en deploy opnieuw.

---

# Boetiek Jamal & Jamila (standaard uit)

Alles hieronder gaat over de onbemande boetiek. Lokaal aanzetten: `BOUTIQUE_ENABLED=true` in `.env` (plus `npm run keys:gen`).

## Het beveiligingsmodel in vier zinnen

1. **De app opent de deur niet.** De telefoon toont een ondertekende claim; de
   scanner aan de deur wisselt die in bij `/api/v1/gate/unlock`. Zou de app dat
   endpoint zelf mogen aanroepen, dan opent iedereen met een onderschepte token
   de winkel vanaf zijn zetel.
2. **De QR is 60 seconden geldig en één keer bruikbaar.** Elke nieuwe uitgifte
   markeert de vorige als achterhaald. Een screenshot is waardeloos.
3. **De handtekening is asymmetrisch (Ed25519).** Op de scanner staat alleen de
   public key. Wie hem uit de muur trekt, kan verifiëren maar niets vervalsen.
4. **Elke poging landt in `AccessLog`** — geslaagd of niet, met een
   camerareferentie. Bij een ongeldige handtekening zónder gebruiker, want de
   claims zijn dan niet te vertrouwen.

## De ontgrendelstroom

```
telefoon                API                     scanner        MQTT      deur
   │                     │                         │            │         │
   │─ POST /access/token ▶                         │            │         │
   │◀ compacte JWS (60s) ─│                         │            │         │
   │                     │                         │            │         │
   │ ══ QR op scherm ════════════════════════════▶ │            │         │
   │                     │◀─ POST /gate/unlock ────│            │         │
   │                     │   x-device-key          │            │         │
   │                     │                         │            │         │
   │              1. handtekening verifiëren       │            │         │
   │              2. winkel-id matchen             │            │         │
   │              3. klant geschikt?               │            │         │
   │                 (actief · toestemming ·       │            │         │
   │                  openingsuren)                │            │         │
   │              ┌── transactie ──────────┐       │            │         │
   │              │ 4. token verbruiken    │       │            │         │
   │              │ 5. bezetting +1        │       │            │         │
   │              │ 6. mandje openen       │       │            │         │
   │              │ 7. AccessLog schrijven │       │            │         │
   │              └────────────────────────┘       │            │         │
   │                     │────────── publish QoS 1 ────────────▶│         │
   │                     │                         │            │─ relais ▶
   │                     │─ GRANTED, basketId ────▶│            │         │
```

**Waarom MQTT ná de commit.** Publiceren binnen de transactie en dan de commit
zien falen, betekent een open deur zonder registratie. Andersom — commit, dan
een mislukte publish — is te repareren, en dat doet `compensateFailedUnlock()`
ook: de bezettingsteller gaat terug en de logregel wordt
`ERROR_GATE_UNREACHABLE`.

## Drie beslissingen in het datamodel

| Beslissing | Waarom |
|---|---|
| Geld is `Int` in centen, nooit `Float` | Een BTW-uitsplitsing over floats verliest vroeg of laat een cent, en dan klopt de kasbon niet met de aangifte |
| `Consent` en `AccessLog` zijn append-only | Bij een klacht bij de Gegevensbeschermingsautoriteit moet je aantonen wát gold op wélk moment. Een overschreven rij bewijst niets |
| BTW zit op het product, niet op de categorie | Een geschenkset met dadels (6%) en arganolie (21%) bestaat. Categorieën vangen dat niet |

## Belgische conformiteit

- **BTW** — Consumentenprijzen zijn inclusief (Boek VI WER, art. VI.3). De BTW
  wordt eruit gerekend, **per tarief afgerond, niet per regel**. Zie
  `packages/vat/src/index.ts` en de test die die fout vangt.
- **Factuurnummering** — Doorlopend en gapenloos per winkel per boekjaar
  (KB nr. 1, art. 5). Daarom `InvoiceCounter` met rijvergrendeling, geen
  sequence (die verliest nummers bij rollback) en zeker geen `count(*)`.
- **AVG** — Toestemming per doel (art. 7.2), marketing nooit als voorwaarde voor
  toegang (art. 7.4), en elke betreding gekoppeld aan een camerafragment zodat
  beelden na de bewaartermijn gericht wisbaar zijn (art. 30).
- **Openingsuren** in `Europe/Brussels`, niet in UTC. België wisselt twee keer
  per jaar van tijdzone; een vaste offset laat de deur op 29 maart een uur te
  lang open.

## itsme

Draait vandaag **niet**. De app authenticeert met e-mail en wachtwoord.

Dat is een bewuste keuze van de opdrachtgever, met een gevolg dat je moet
kennen: een wegwerpmailadres bewijst niets over wie er om 3u 's nachts voor de
deur staat, en bij schade heb je geen identiteit. Voor een onbemande winkel is
dat een reëel aansprakelijkheidsrisico.

De code is er wel op voorbereid:

- `IdentityProvider` (`apps/api/src/auth/identity-provider.ts`) is de naad.
  Vandaag zit daar `LocalIdentityProvider` achter; morgen een
  `ItsmeIdentityProvider` die de OIDC Authorization Code + PKCE flow afhandelt.
- `User.identityVerified` en `User.ageVerified` bestaan al en staan op `false`.
- `Store.requiresVerifiedIdentity` staat op `false`. Zet hem aan zodra itsme
  draait, en `GateService.assertEligible()` weigert iedereen zonder sterke
  identiteit — zonder dat er één bestaande regel wijzigt.

Wat je nodig hebt om hem aan te zetten: een itsme merchant-contract, een
`client_id`, en een certificaat voor de token-endpoint.

## Zelf uitproberen

Met de vier processen draaiend: open **http://localhost:3000**.

1. **Registreer** — beide AVG-vinkjes zijn verplicht, de knop blijft anders uit.
2. **Kies de winkel** (Antwerpen Zuid). Je krijgt je QR-sleutel te zien.
3. **Open de deurscanner** via de knop eronder → `/simulator/deur`.
   Zonder deze pagina kom je niet verder: de app kán de deur niet openen, dat is
   het beveiligingsmodel. Het kastje aan de muur wisselt de QR in, niet de telefoon.
4. Druk op *"Klant houdt sleutel voor de scanner"*. De deurcontroller in
   `npm run dev:gate` logt `🔓 RELAIS AAN`.
   Druk daarna op *"Scan dezelfde code nogmaals"* — dat hoort `DENIED_REPLAY` te geven.
5. **Scannen** — camera in Chrome/Edge, of tik een code in:
   `5412345000013` (serum, 21%) · `5412345000044` (kaars, 21%) · `5412345000075` (dadels, 6%).
   Probeer ook `5412345000018`: fout controlecijfer, wordt geweigerd.
6. **Mandje → Bancontact → betalen.** Zonder Mollie-sleutel land je op een
   simulatiepagina; bevestig daar en je kasbon staat klaar bij *Aankopen*.

> **`/simulator/deur` is dev-only.** De apparaatsleutel staat in de browserbundel.
> Zet vóór elke deploy `NEXT_PUBLIC_ENABLE_DEV_SCANNER=false` **én** laat
> `NEXT_PUBLIC_DEV_DEVICE_KEY` leeg — de vlag alleen is niet genoeg, want
> `NEXT_PUBLIC_*` wordt bij de build ingebakken. Met beide uit geeft de route een
> 404 en zit de sleutel nergens in de build (geverifieerd).

## De klant-app

Next.js PWA, twee thema's, Nederlands en Frans.

- **Mijn Sleutel** — roterende QR met aftelring. Vernieuwt na 30s, verloopt na 60s.
- **Scannen** — `BarcodeDetector` (Chrome/Edge) met handmatige invoer als volwaardig
  alternatief; Safari heeft de API niet. Beide paden komen langs dezelfde
  controlecijfer-validatie op de server.
- **Mandje** — btw-uitsplitsing per tarief, zichtbaar vóór het afrekenen.
- **Aankopen** — kasbonnen uit de onveranderlijke `Receipt.snapshot`, nooit
  opnieuw samengesteld uit de catalogus.

Het thema wisselen is één attribuut op `<html>`; geen component kent zijn kleuren.
Zie `apps/pwa/src/app/globals.css`.

## Wat er nog niet is

- **Een echte Mollie-sleutel.** Zonder `MOLLIE_API_KEY` draait de
  `StubPaymentGateway`, die elke betaling als geslaagd markeert. Alles daarná —
  order, voorraad, gapenloos factuurnummer, kasbon — is wél end-to-end getest.
  De gateway weigert dienst zodra `NODE_ENV=production`.
- **Terugmelding van de hardware.** De API weet nu dat de *broker* het commando
  aannam, niet dat het relais bewoog. Een echte controller publiceert op
  `store/{id}/gate/state`; die lus hoort bij de hardware-integratie.
- **Service worker / offline.** De app is installeerbaar (manifest + icoon) maar
  cachet niets. Zinvol offline werken kan hier nauwelijks: zonder server geen
  geldige sleutel.
- **Sessietoken in `localStorage`** (boetiek-app). Werkt, maar een XSS-lek geeft
  het weg. De API ondersteunt sinds oktober 2026 HttpOnly-cookiesessies met
  refresh-rotatie (header `x-superette-client: web`, gebruikt door de
  Superette-app); de boetiek-app kan daar later op overstappen. Zie
  `docs/SECURITY.md`.
- **Opruimtaak** voor verlopen tokens (`AccessTokenService.purgeExpired()`
  bestaat, de cron eromheen niet).
- **Migraties.** Sinds oktober 2026 via `prisma migrate` (`apps/api/prisma/migrations`):
  een baseline `0_init_jamal_jamila` plus de additieve migratie van de
  vergelijker. `db push` blijft alleen voor lokaal experimenteren; bestaande
  databases baseline je eenmalig met `prisma migrate resolve --applied`, zie
  `docs/COMPARE.md`.
- **`postcss`-override.** Next 15.5 pint `postcss@8.4.31` (GHSA-qx2v-qp2m-jg93).
  De root `overrides` tilt hem naar 8.5; de Next-build is daarmee geverifieerd.
  Weghalen zodra Next zelf bijwerkt.
