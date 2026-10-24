# Jamal & Jamila — onbemand winkelplatform

Toegangscontrole, self-scanning en Belgisch-conforme kasbonnen voor een
high-end, onbemande boetiek.

> **Superette — supermarktvergelijker.** Dezelfde monorepo bevat sinds oktober
> 2026 een tweede domein: een Belgische supermarktvergelijker (Delhaize, Lidl,
> Colruyt, SPAR, Albert Heijn, Jumbo, Carrefour) met productzoeken,
> prijsnormalisatie per kg/l/stuk, productmatching, boodschappenlijsten,
> mandje-vergelijking en prijsalerts, met een eigen app in `apps/superette-web`
> (poort 3001). **Alle supermarktgegevens zijn op dit moment demogegevens**,
> overal zo gelabeld. Zie **[docs/COMPARE.md](docs/COMPARE.md)**.

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
npm run keys:gen          # plak de uitvoer in .env
npm run build

npm run dev:db            # terminal 1 — embedded PostgreSQL op :5432
npm run db:migrate:deploy # schema aanmaken via migraties (zie docs/COMPARE.md § Migraties)
npm run db:seed           # winkel + 8 producten + device-sleutel
npm run db:seed:compare   # supermarktvergelijker: 7 ketens op demogegevens
npm run dev:web           # terminal 5 — Superette-app op :3001

npm run dev:gate          # terminal 2 — MQTT-broker + deurcontroller
npm run dev:api           # terminal 3 — API op :4000
npm run dev:pwa           # terminal 4 — app op :3000
```

Met Docker (de productieweg):

```bash
docker compose up -d      # Postgres + Mosquitto
```

Verifiëren dat alles klopt:

```bash
npm test              # 244 unit-tests (btw, ean, token-crypto, openingsuren, bedragen, prijsnormalisatie, matching, mandje, alerts, cookies, logredactie, foutfilter, bronstatus, e-mail, importgrens)
npm run smoke:gate    # 29 checks tegen de live API — replay, rotatie, vervalsing
npm run smoke:shop    # 35 checks — scannen, btw, webhook-idempotentie, factuurnummers
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
