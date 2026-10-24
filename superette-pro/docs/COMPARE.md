# Superette — supermarktvergelijker

De supermarktvergelijker is een tweede *bounded context* in deze monorepo, naast
het boetiekplatform van Jamal & Jamila. Ze deelt de gebruikersaccounts, de
database, de Zod-contracten en de NestJS-conventies; verder raakt ze niets van
de boetiek aan.

> **Status in één zin.** Datalaag, prijslogica, matching, mandje-optimalisatie,
> prijsalerts, meldingen, de API én een eigen app (`apps/superette-web`) zijn
> geïmplementeerd en getest. **Alle huidige supermarktgegevens zijn
> demogegevens** (`source = DEMO`): de zeven ketens draaien op verzonnen prijzen
> zolang er geen importbestand of overeengekomen databron is. De app toont dat
> bij elke prijs, in een banner op elke pagina en op de pagina "Over de gegevens".

## Inhoud

0. [De app: apps/superette-web](#de-app-appssuperette-web)
1. [Architectuur](#architectuur)
2. [Ondersteunde supermarkten en databronnen](#ondersteunde-supermarkten-en-databronnen)
3. [Adapterinterface](#adapterinterface)
4. [Datamodel](#datamodel)
5. [Prijsnormalisatie](#prijsnormalisatie)
6. [Productmatching](#productmatching)
7. [Mandje vergelijken](#mandje-vergelijken)
8. [Prijsalerts en meldingen](#prijsalerts-en-meldingen)
9. [API](#api)
10. [Lokale installatie](#lokale-installatie)
11. [Environmentvariabelen](#environmentvariabelen)
12. [Seeddata en import via JSON/CSV](#seeddata-en-import-via-jsoncsv)
13. [Achtergrondtaak](#achtergrondtaak)
14. [Tests](#tests)
15. [Een nieuwe supermarktadapter toevoegen](#een-nieuwe-supermarktadapter-toevoegen)
16. [Traceerbaarheid requirements](#traceerbaarheid-requirements)
17. [Bekende beperkingen en openstaand](#bekende-beperkingen-en-openstaand)

## De app: apps/superette-web

Een aparte Next.js-PWA (poort 3001) met een eigen, warme Superette-identiteit:
licht "papier"-canvas, baksteenrode merkkleur, kruideniersgroen voor prijzen,
donker thema via `prefers-color-scheme` of handmatig. Ze deelt met de boetiek
alleen de API, de contracten, het pricing-package en de accounts; geen enkele
component, kleur of tekst uit `apps/pwa` wordt hergebruikt.

| Scherm | Route | Account |
|---|---|---|
| Landingspagina | `/` | – |
| Zoeken met filters en sortering (URL-state) | `/zoeken?q=…&winkels=…&sorteer=…` | – |
| Productdetail: prijzen per keten, equivalenten, alternatieven, geschiedenis | `/producten/:id` | – |
| Actuele promoties | `/promoties` | – |
| Uitleg over databronnen en demodata | `/over-de-gegevens` | – |
| Inloggen / account maken | `/inloggen`, `/registreren` | – |
| Boodschappenlijsten, lijst bewerken, mandje vergelijken (3 modi) | `/lijsten`, `/lijsten/:id` | ✓ |
| Supermarktvoorkeuren (bezoekers: lokaal in de browser) | `/profiel/voorkeuren` | ✓ / lokaal |
| Prijsalert aanmaken (met preview) en bewerken | `/alerts/nieuw?product=:id`, `/alerts/:id` | ✓ |
| Mijn prijsalerts (filters, sortering, pauzeren, hervatten, verwijderen) | `/alerts` | ✓ |
| In-app meldingen | `/meldingen` | ✓ |
| Profiel en instellingen (taal nl/fr/en, thema) | `/profiel` | – |

**Navigatie.** Mobiel een tabbalk met Home, Zoeken, Mijn lijst, Prijsalerts en
Profiel; op desktop dezelfde vijf in de koptekst. Elke pagina heeft een
skip-link, één `h1`, een `main`-landmark en gelabelde navigatie.

**Taal en notatie.** Nederlands eerst; Frans en Engels volledig vertaald
(`src/lib/messages.ts`, type-gecontroleerd op gelijke sleutels). Bedragen,
datums en tijden via `Intl` in `nl-BE` / `fr-BE` / `en-BE`, tijdzone
`Europe/Brussels` (`src/lib/format.ts`).

**Authenticatie.** Zelfde `User`-tabel en JWT als de boetiek. Registreren gaat
via `POST /auth/register-superette`: zonder de toegangslog- en
cameratoestemmingen van de winkel (die horen bij de deur, niet bij prijzen).
Een boetiekaccount kan in Superette inloggen en omgekeerd; de boetiek vraagt
haar toestemmingen zelf bij de eerste deuropening. De API staat beide origins
toe (`APP_URL`, `SUPERETTE_WEB_URL`, optioneel `CORS_ORIGINS`).

**Geheimen.** De app kent geen interne sleutels. `COMPARE_JOB_KEY` staat
nergens in een `NEXT_PUBLIC_`-variabele; het interne sync-endpoint weigert
bovendien elke request met een `Origin`- of `Sec-Fetch-Site`-header, dus ook
een browser mét de sleutel komt er niet door.

**Grafiek.** De prijslijn (`src/components/price-history-chart.tsx`) volgt de
dataviz-regels: één as, kleur per keten in vaste volgorde (gevalideerd palet
voor licht en donker), legenda vanaf twee reeksen, kruisdraad met één tooltip,
toetsenbordbediening met pijltjestoetsen, en altijd een tabelweergave.

```bash
npm run dev:web                         # http://localhost:3001
npm run build -w @superette/web         # productiebuild
npm run test -w @superette/web          # unit-tests (formattering, URL-state, voorkeuren, vertalingen)
COMPARE_JOB_KEY=… npm run walkthrough:superette   # doorloop in Chromium + schermafbeeldingen
```

## Architectuur

```
apps/superette-web/               Superette-app (Next.js 15, React 19, Tailwind 4, nl/fr/en)
packages/pricing/                 zuivere prijslogica (geen deps): centen, eenheden, promoties, statiegeld
packages/contracts/src/compare/   Zod-schema's + types, gedeeld door API en app
apps/api/src/compare/
├── adapters/                     SupermarketAdapter-interface, fabriek, register, feed-validatie (JSON/CSV)
│   ├── delhaize.adapter.ts … carrefour.adapter.ts   (7 ketens)
│   └── adapter-registry.ts       de enige lijst met ketens
├── demo/demo-catalog.ts          verzonnen demogegevens, deterministisch, gelabeld DEMO
├── import/import.service.ts      snapshot → database (idempotent), geschiedenis, matching
├── matching/product-matcher.ts   deterministische matching (exact / equivalent / alternative / uncertain)
├── pricing/offer-pricing.ts      regelprijs met promotievoorwaarden, prijsstatus
├── catalog/                      laad- en vertaallaag (DTO's met herkomst), ketens/filialen/categorieën
├── search/                       zoeken, productdetail, promoties, match melden
├── basket/basket-optimizer.ts    één winkel / goedkoopste combinatie / gebalanceerd
├── lists/                        boodschappenlijsten + doorrekenen
├── preferences/                  winkelvoorkeuren in het profiel
├── alerts/                       alert-evaluator (zuiver) + service (laden, controleren, klaarzetten)
├── notifications/                kanaal-interface, in-app, e-mail (uit), dispatcher (digest, idempotent)
└── jobs/                         sync-service (planner), jobsleutel-guard, interne endpoints
```

**Ontwerpregels**

- Geld is altijd `Int` in centen, ook eenheidsprijzen (centen per kg / l / stuk).
- Elke prijs draagt bron, controlemoment, geldigheid, betrouwbaarheid en status
  (`CURRENT`, `STALE`, `EXPIRED`, `DEMO`, `UNVERIFIED`). Demo wordt nooit als
  actuele winkelprijs voorgesteld.
- De kern kent geen ketenformaat. Alles komt binnen als `AdapterSnapshot`.
- Zuivere modules (`pricing`, `matcher`, `optimizer`, `alert-evaluator`) hebben
  geen database en zijn in milliseconden te testen.
- Autorisatie gebeurt in de service, nooit alleen in de interface. "Bestaat niet"
  en "niet van jou" geven dezelfde `404`.

## Ondersteunde supermarkten en databronnen

| Keten | Adaptersleutel | Klantenkaart | Databron vandaag | Nodig voor live |
|---|---|---|---|---|
| Delhaize | `delhaize` | SuperPlus | importbestand / demo | overeenkomst of gelicentieerde feed |
| Lidl | `lidl` | Lidl Plus | importbestand / demo | idem |
| Colruyt | `colruyt` | Xtra | importbestand / demo | partnertoegang Colruyt Group |
| SPAR | `spar` | — | importbestand / demo | per filiaal (zelfstandigen) |
| Albert Heijn | `albert-heijn` | Bonuskaart | importbestand / demo | Belgische feed, niet de Nederlandse |
| Jumbo | `jumbo` | — | importbestand / demo | overeenkomst |
| Carrefour | `carrefour` | Bonus Card | importbestand / demo | overeenkomst; formules verschillen |

**Er wordt niet gescrapet.** Toegestane bronnen zijn officiële API's,
gelicentieerde feeds, gegevens van deelnemende handelaars, overeengekomen
integraties en handmatig beheerde importbestanden. Elke adapter declareert
`source.termsReviewed`; zolang dat `false` is, levert hij alleen importbestanden
en (buiten productie) demogegevens. **Juridische verificatie per keten is nog
niet gebeurd** — dat is mensenwerk vóór een live koppeling.

### Bronstatus en live-criteria

De API berekent per keten een `sourceStatus` (`GET /compare/chains`,
`sourceStatusOf()` in `chains.controller.ts`, unit-getest); de app toont die
als badge en toont nooit iets als "live" dat het niet is.

| Status | Betekenis | Voorwaarde |
|---|---|---|
| `UNAVAILABLE` | geen gegevens | nog nooit een geslaagde import |
| `DEMO` | verzonnen prijzen, duidelijk gelabeld | laatste import had `source = DEMO` (alleen buiten productie mogelijk) |
| `STALE` | mogelijk verouderd | laatste geslaagde import ouder dan `COMPARE_PRICE_FRESH_HOURS` |
| `UNVERIFIED` | echte bron, voorwaarden niet nagekeken | import geslaagd maar `termsReviewed = false` |
| `LIVE` | echte, verse, geverifieerde prijzen | **alle** onderstaande criteria |

Een keten is pas **LIVE** als (1) de voorwaarden/overeenkomst door een mens zijn
nagekeken en de adapter `termsReviewed: true` declareert; (2) de bronconfiguratie
(importbestand, feed-URL of partnertoegang) staat; (3) minstens één import
`SUCCEEDED` is; (4) een steekproef van prijzen handmatig is gevalideerd; (5) de
laatste import jonger is dan de versheidsgrens. In productie staat
`COMPARE_ALLOW_DEMO` af en kan het niet aan; de adapters genereren daar geen
demogegevens. Een adapter die scrapet bestaat niet en wordt niet toegevoegd.

**Alerts en DEMO.** In productie-modus negeert de alert-evaluator DEMO-prijzen
(`allowDemo = false`): een prijsalert kan nooit afgaan op een verzonnen prijs,
ook niet als iemand een DEMO-gelabeld importbestand zou plaatsen.

**Stagingbestanden.** `npm run staging:feeds -- <map> [--unverified spar]`
maakt importbestanden uit de demogenerator met `source.kind = DEMO` (overal
DEMO-badge). Met `--unverified` krijgt een keten `IMPORT_FILE` met
`termsReviewed = false` (status `UNVERIFIED`, label "fictief, niet
geverifieerd"); alleen zo kan staging de alert- en meldingspijplijn in
productie-modus testen. Deze bestanden horen nooit in een productie-feedmap.

### Scrapers en motoren (stand 24 oktober 2026)

Twee motoren, één set beleefdheidsregels (`scripts/scrape/polite-common.ts`): robots.txt per URL,
identificatie `SuperetteBot/0.1 (+SCRAPE_CONTACT)`, minstens 5 s tussen verzoeken (of de Crawl-delay van
de site), een maximum per run, en stoppen bij 401/403/429/503 of een blokkeerpagina.

| Motor | Bestand | Wanneer |
|---|---|---|
| Browser (Playwright/Chromium) | `polite-browser.ts` | pagina's die hun prijs pas na het laden tonen; standaard |
| Scrapling (gewone HTTP) | `polite-scrapling.ts` + `scrapling_worker.py` | prijs staat al in de server-HTML; `SCRAPE_ENGINE=scrapling` |

De Scrapling-worker draait met `impersonate=None` en `stealthy_headers=False`: geen browser-imitatie,
geen stealth- of browsermodus. Een site die gewone HTTP-clients weigert, krijgt die keuze gerespecteerd.

| Keten | Script | Bron | Stand |
|---|---|---|---|
| Carrefour | `npm run scrape:carrefour` | officiële sitemap → publieke productpagina's (schema.org) | parser + 20 tests klaar; proefruns 24/10 eindigden met HTTP 403 na herhaalde proeven, run gestopt. Opnieuw proberen in een rustige run. |
| Colruyt | — | prijs alleen via privé-API `apix.colruyt.be` met sleutel | niet gebouwd: vraagt partnertoegang Colruyt Group |
| SPAR | — | idem (Colruyt Group) | niet gebouwd: zelfde reden |
| Lidl | `npm run scrape:lidl` | publieke categoriepagina's | lidl.be toont online maar ±12 voedingsproducten met prijs (weekacties); breder zoeken gaf 24/10 enkel non-food en daarna HTTP 429. Instelling smal gelaten. |
| Jumbo | `npm run import:jumbo:w43 -- <pad naar PDF>` | Belgische folder (PDF), gecontroleerde selectie | week 43 (21-27/10): 35 prijsvoorbeelden, 34 als MULTIBUY; elke rekensom sluit op de cent, p3 en p8 visueel nagekeken. jumbo.com zelf toont Nederlandse prijzen. Elke week een nieuwe folder = nieuwe controle. |
| Aldi, Delhaize, AH | bestaande scripts | ongewijzigd | feeds van 17-19 oktober |

Diagnose: `SCRAPE_DEBUG_DIR=<map>` bewaart onleesbare pagina's (nooit standaard). Proefrun:
`SCRAPE_CONTACT=… COMPARE_FEED_DIR=data/feeds-proef npm run scrape:carrefour -- 20`.
Alle feeds blijven `termsReviewed: false` (status UNVERIFIED) tot de voorwaarden per keten door een mens
zijn nagekeken.

## Adapterinterface

`apps/api/src/compare/adapters/supermarket-adapter.ts`

```ts
interface SupermarketAdapter {
  key: string;                       // 'delhaize'
  chain: AdapterChainInfo;           // slug, naam, logo, website, klantenkaart
  source: AdapterSourceInfo;         // kind, label, termsReviewed, notes
  fetchSnapshot(ctx): Promise<AdapterSnapshot | null>;
}

interface AdapterSnapshot {
  chain; source; observedAt;
  locations: NormalizedLocation[];       // filialen (externalId, adres, postcode, coördinaten)
  products:  NormalizedStoreProduct[];   // sku, naam, merk, barcode, afbeelding, categorie, verpakking
  offers:    NormalizedOffer[];          // prijs, promo, voorwaarden, klantenkaart, kanaal, filiaal, geldigheid
}
```

`createChainAdapter()` doorloopt per keten: live bron (indien aanwezig) →
`<key>.json` → `<key>.csv` → demo (alleen als `allowDemo`). Niets gevonden
geeft `null`; de importrun eindigt dan als `FAILED` met een duidelijke notitie.

**Prijsconventie in een aanbieding.** `priceCents` is wat je vandaag voor één
verpakking betaalt, zonder statiegeld, met *onvoorwaardelijke* promoties
(vaste promoprijs, −30 %) verrekend; dan staat de gewone prijs in
`originalPriceCents`. *Voorwaardelijke* promoties ("2 voor €5", "1+1",
staffel, "2de aan −50 %") staan in `promotionRule`; `priceCents` is dan de
gewone prijs. Zo kan een bundelprijs nooit als stukprijs doorgaan.

## Datamodel

Prisma, additief naast de boetiek (`apps/api/prisma/schema.prisma`, sectie
"Supermarktvergelijker"). Mapping op de conceptuele modellen uit de opdracht:

| Opdracht | Implementatie | Opmerking |
|---|---|---|
| StoreChain | `StoreChain` | + `adapterKey`, `loyaltyCardName` |
| StoreLocation | `StoreLocation` | uniek op `(keten, externalId)` |
| Product | `CatalogProduct` + `StoreProduct` | canoniek product + ketenspecifieke listing; inhoud mag `null` zijn |
| ProductOffer | `ProductOffer` | hangt aan `StoreProduct`; uniek op `(keten, sourceReference)` |
| PriceHistory | `PriceHistory` | append-only; alleen winkelprijzen (niet persoonlijk, niet online-only) |
| productmatch | `ProductMatch` (+ `ProductMatchReport`) | gericht, beide richtingen; `AUTO` / `CONFIRMED` / `REJECTED` |
| boodschappenlijst | `ShoppingList`, `ShoppingListItem` | voorkeuren per regel |
| voorkeuren | `ComparePreference`, `UserChainPreference`, `UserFavoriteLocation` | |
| PriceAlert | `PriceAlert` | + `armed` voor "niet twee keer melden" |
| PriceAlertStore | `PriceAlertStore` | geen rijen = voorkeuren van de gebruiker |
| AlertNotification | `AlertNotification` | `idempotencyKey` uniek, `digestKey` per gebruiker per dag |
| importstatus | `ImportRun` | tellers, fouten (zonder geheimen), bron |

Enums spiegelen `packages/contracts/src/compare/enums.ts`.

## Prijsnormalisatie

`packages/pricing` — zuiver, zonder dependencies, 61 unit-tests.

- `money`: `eurosToCents("1,79") → 179`, half-up afronding in integer-rekenkunde,
  `discountPercentage`, `applyPercentageDiscount`, `formatCents` (nl-BE).
- `units`: `G/KG/ML/CL/L/PIECE` → basiseenheid gram / milliliter / stuk (integer);
  `parseQuantityLabel("6 x 33 cl")`; `formatBaseQuantity`.
- `normalize`: `normalizePackage` (multipacks → totale inhoud), `unitPrice`
  (centen per kg / l / stuk). Ontbreekt de inhoud: `{ ok: false, reason, message }`
  — nooit een verzonnen waarde.
- `promotions`: regels `FIXED_PRICE`, `PERCENTAGE`, `BUY_X_GET_Y_FREE`, `MULTIBUY`,
  `VOLUME_DISCOUNT`, `NTH_AT_DISCOUNT`; `effectivePrice(regular, rule, quantity)`
  geeft totaal, effectieve stukprijs, besparing, `conditionMet`, `minimumQuantity`
  en een Nederlandse toelichting. Een promotie die niets bespaart telt niet.
- `deposit`: statiegeld apart van de productprijs, nooit in de eenheidsprijs.

## Productmatching

`apps/api/src/compare/matching/product-matcher.ts` — deterministisch, 19 tests.

| Laag | Resultaat | Confidence |
|---|---|---|
| zelfde barcode | `EXACT` | 1,00 |
| zelfde merk + naam + inhoud (`matchKey`) | `EXACT` | 0,95 |
| zelfde merk + naam, andere inhoud | `EQUIVALENT` | 0,85 |
| ander merk, (vrijwel) dezelfde naam, vergelijkbare inhoud, zelfde categorie | `ALTERNATIVE` | 0,60–0,80 |
| lijkt erop, onvoldoende zeker (bv. smaakvariant van hetzelfde merk) | `UNCERTAIN` | < 0,60 |

Huismerknamen ("Boni", "365", "Milbona", …) worden uit de genormaliseerde naam
gehaald; A-merknamen blijven staan. Een huismerk wordt nooit `EXACT`.
`UNCERTAIN` wordt nooit als vergelijking getoond; de productdetailpagina meldt
alleen het aantal. Bij import worden matches in beide richtingen bewaard;
bestaande rijen — ook door een mens bevestigde (`CONFIRMED`) of afgewezen
(`REJECTED`) — worden nooit overschreven, dus bij een volgende import hoeft
niets opnieuw gematcht te worden. Gebruikers kunnen een onjuiste match melden
(`POST /compare/products/:id/report-match`); dat landt in `ProductMatchReport`
voor de beheerfase. AI-matching is bewust niet toegevoegd.

## Mandje vergelijken

`apps/api/src/compare/basket/basket-optimizer.ts` — zuiver, 17 tests.

Per regel en per keten kiest `selectLine` het goedkoopste toegestane aanbod,
met de voorkeuren van de regel (exact merk, huismerk, alternatieven,
maximumprijs), de instellingen (klantenkaart, persoonlijk, online) en
promotievoorwaarden (via `lineCost`: "1+1" telt pas vanaf 2). Elke regel krijgt
een `reason`.

- **Alles bij één winkel** — zoveel mogelijk producten, dan de laagste prijs.
- **Goedkoopste combinatie** — elke regel bij de goedkoopste bereikbare winkel.
- **Gebalanceerd** — beste deelverzameling van hoogstens `maxStores` (1–3)
  winkels; een extra winkel alleen als die minstens `minimumSavingCents`
  (standaard €3) per extra bezoek oplevert of extra producten beschikbaar maakt.
  De uitleg staat in `explanation`.

Ontbrekende producten blijven zichtbaar (`MISSING` / `OVER_BUDGET`), vrije
tekstregels worden apart gemeld, statiegeld staat apart in de aanbieding.
Afstand (`maxDistanceKm`) is voorbereid maar nog zonder locatie van de gebruiker.

## Prijsalerts en meldingen

- Alert op één product of een categorie; vergelijking op verpakkingsprijs,
  eenheidsprijs of kortingspercentage; één, meerdere of alle (voorkeur)ketens;
  matchvoorkeur `EXACT` / `EQUIVALENT` / `ALTERNATIVE`.
- `POST /compare/alerts/preview` geeft de huidige laagste prijs, het verschil,
  een bevestigingszin en of er al een identieke alert bestaat (dan `409` met
  `existingAlertId` bij aanmaken).
- `alert-evaluator.ts` (zuiver, 22 tests): grens bereikt bij ≤ (prijzen) of ≥
  (korting); klantenkaart-, persoonlijke en online-prijzen alleen als toegestaan;
  onzekere matches nooit; demo alleen buiten productie.
- **Niet twee keer melden**: na een melding staat `armed = false`; opnieuw melden
  kan alleen bij een nieuwe, lagere prijs, of nadat de prijs weer boven de grens
  kwam (`rearm`). Elke melding heeft `idempotencyKey = alert:aanbieding:prijs`.
- Meldingen worden per gebruiker per dag gegroepeerd (`digestKey`) en door een
  kanaal afgeleverd: **in-app** werkt; **e-mail** staat uit tot er een provider
  is (`NOTIFY_EMAIL_ENABLED`), en wordt dan eerlijk als `SKIPPED` geregistreerd.
  Mislukte leveringen worden hoogstens 3× opnieuw geprobeerd.
- Een melding bevat product, keten, filiaal, nieuwe en vorige prijs, grens,
  besparing, eenheidsprijs, voorwaarden, geldigheid, link en een goedkoper
  alternatief als dat er is.

## API

Alle routes onder `/api/v1/compare`. Validatie met Zod uit `@superette/contracts`;
fouten als `{ message, issues[] }`; rate limits per route.

| Methode | Pad | Auth | Doel |
|---|---|---|---|
| GET | `/chains` | – | ketens met bronsoort en laatste import |
| GET | `/chains/:slug/locations?postalCode=&city=` | – | filialen |
| GET | `/categories` | – | categorieën |
| GET | `/search?q=&chains=&sort=&…` | – | zoeken; filters: categorie, merk, huismerk/A-merk, alleen promoties, klantenkaart, eenheid, beschikbaarheid, maxprijs; sortering: eenheidsprijs, verpakkingsprijs, korting, winkel, relevantie |
| GET | `/promotions` | – | actuele aanbiedingen |
| GET | `/products/:id` | – | detail: prijzen per keten, equivalenten, alternatieven, geschiedenis, dekking |
| GET | `/products/:id/history` | – | prijsgeschiedenis (90 dagen) |
| POST | `/products/:id/report-match` | JWT | onjuiste match melden |
| GET/PATCH | `/preferences` | JWT | winkelvoorkeuren |
| GET/POST | `/lists`, GET/PATCH/DELETE `/lists/:id` | JWT | boodschappenlijsten |
| POST/PATCH/DELETE | `/lists/:id/items[/:itemId]` | JWT | regels |
| POST | `/lists/:id/compare` | JWT | mandje doorrekenen (`mode`, `maxStores`, `minimumSavingCents`, …) |
| GET/POST | `/alerts`, POST `/alerts/preview` | JWT | alerts |
| GET/PATCH/DELETE | `/alerts/:id`, POST `/alerts/:id/pause|resume` | JWT | beheren |
| GET | `/notifications`, POST `/notifications/:id/read` | JWT | meldingen |
| POST | `/internal/sync` | `x-job-key` | volledige synchronisatie |
| GET | `/internal/status` | `x-job-key` | laatste importrun per adapter |

Zonder `COMPARE_JOB_KEY` bestaan de interne endpoints niet (`404`).

## Lokale installatie

```bash
npm install
npm run keys:gen            # bestaand: plak in .env
npm run build               # bouwt vat, pricing, contracts, api, pwa en web

npm run dev:db              # terminal 1 — embedded PostgreSQL
npm run db:migrate:deploy   # migraties toepassen (zie "Migraties")
npm run db:seed             # boetiek (bestaand)
npm run db:seed:compare     # vergelijker: 7 ketens op demogegevens

npm run dev:api             # terminal 2 — API op :4000
npm run dev:web             # terminal 3 — Superette-app op :3001
npm run smoke:compare       # rooktest tegen de live API
```

`npm run compare:sync -- lidl spar` synchroniseert alleen die adapters.

### Migraties

Vanaf nu is **`prisma migrate` de productiestrategie**; `db push` blijft alleen
voor snel lokaal experimenteren. `apps/api/prisma/migrations/` bevat:

| Migratie | Inhoud |
|---|---|
| `0_init_jamal_jamila` | baseline van de boetiek: 14 tabellen, exact de toestand vóór de vergelijker |
| `20261004180000_supermarktvergelijker` | 18 nieuwe tabellen en 15 enums; **geen** `DROP`, geen wijziging aan bestaande tabellen |

- **Nieuwe omgeving:** `npm run db:migrate:deploy` (past beide toe).
- **Bestaande database die met `db push` is gevuld** (zoals de lokale
  dev-database): markeer eerst wat er al staat als toegepast, daarna deploy:
  ```bash
  cd apps/api
  npx prisma migrate resolve --applied 0_init_jamal_jamila
  npx prisma migrate resolve --applied 20261004180000_supermarktvergelijker   # alleen als de compare-tabellen er al staan
  npx prisma migrate deploy
  npx prisma migrate status            # "Database schema is up to date!"
  ```
- **Controle:** `prisma migrate diff --from-migrations … --to-schema-datamodel …`
  meldt geen verschil tussen migraties en schema (driftcheck, uitgevoerd).

Getest op 4 oktober 2026: (a) lege database → beide migraties, 33 tabellen,
compare-seed werkt; (b) database met boetiekdata (winkel, 8 producten,
voorraad, gebruiker met toestemmingen, winkelsessie, bestelling, kasbon) →
alleen de compare-migratie wordt toegepast, alle rijen en de kasbon-snapshot
blijven intact, compare-seed werkt daarna; (c) de lokale dev-database is
gebaselined en meldt "up to date". De test staat beschreven in dit bestand
en is herhaalbaar met de stappen hierboven.

## Environmentvariabelen

| Variabele | Standaard | Betekenis |
|---|---|---|
| `COMPARE_FEED_DIR` | `data/feeds` | map met `<key>.json` / `<key>.csv`, relatief aan `apps/api` |
| `COMPARE_ALLOW_DEMO` | aan buiten productie | demogegevens als er geen bestand is; in productie afgedwongen uit |
| `COMPARE_JOB_KEY` | leeg | sleutel (≥ 16 tekens) voor `/internal/*` en `/health/status`; leeg = endpoints bestaan niet |
| `COMPARE_JOB_KEY_PREVIOUS` | leeg | vorige sleutel tijdens een rotatie |
| `COMPARE_PRICE_FRESH_HOURS` | `48` | daarna status `STALE` |
| `COMPARE_SYNC_INTERVAL_MINUTES` | `0` | interne planner in de API (0 = uit); de werker gebruikt dezelfde variabele als interval (standaard 60) |
| `COMPARE_SYNC_LEASE_MINUTES` | `20` | hoe lang een synchronisatie de databaselease houdt |
| `COMPARE_ADAPTER_TIMEOUT_MS` | `60000` | timeout per adapter; daarna één nieuwe poging |
| `EMAIL_PROVIDER` / `EMAIL_FROM` / `EMAIL_HTTP_URL` / `EMAIL_API_KEY` / `EMAIL_OUTBOX_DIR` | `none` | e-mailtransport: `none` (eerlijk overslaan), `file` (outbox), `http` (JSON-API) |
| `NOTIFY_EMAIL_ENABLED` | `false` | e-mailkanaal; kan niet aan zonder provider |
| `SUPERETTE_WEB_URL` | `http://localhost:3001` | origin van de Superette-app (CORS, CSRF) |
| `CORS_ORIGINS` | leeg | extra origins, kommagescheiden |
| `TRUST_PROXY`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `WEB_ACCESS_TTL_SECONDS`, `WEB_REFRESH_TTL_DAYS`, `HSTS_ENABLED`, `LOG_FORMAT`, `APP_VERSION`, `ERROR_REPORTING_DSN` | zie `.env.example` | productie: proxy, cookies, sessies, logging (`docs/SECURITY.md`, `docs/DEPLOYMENT.md`) |
| `NEXT_PUBLIC_API_URL` (app) | `http://localhost:4000/api/v1` | ingebakken bij de build; verplicht en `https` in productie. Optioneel `NEXT_PUBLIC_IMAGE_HOSTS`, `NEXT_PUBLIC_ANALYTICS_ORIGIN` (CSP) |

## Seeddata en import via JSON/CSV

- Demogegevens: `apps/api/src/compare/demo/demo-catalog.ts` — 27 A-merk/versproducten
  en 36 huismerkproducten over 7 ketens, met per keten een prijsniveau, ontbrekende
  producten en promoties van elk type (1+1, 2 voor €2,50, −20 %, staffel, 2de aan
  −50 %, klantenkaart, persoonlijk, online-only, regionaal per filiaal, statiegeld).
  Deterministisch; barcodes met geldig controlecijfer in een eigen prefix.
- Importbestanden: `apps/api/data/feeds/README.md` + `example.json`. Validatie in
  `feed-schema.ts`; CSV via `csv-feed.ts`.

## Achtergrondtaak

`SyncService.runSync()`:

1. adapters na elkaar importeren (rate limits per bron);
2. normaliseren (eenheidsprijs), matchen, deactiveren wat de bron niet meer noemt;
3. verlopen aanbiedingen deactiveren;
4. prijsgeschiedenis aanvullen bij een gewijzigde prijs;
5. actieve alerts controleren, meldingen klaarzetten (idempotent);
6. meldingen per overzicht versturen, fouten registreren, hoogstens 3 pogingen.

Overlap wordt geweigerd (`409 SYNC_ALREADY_RUNNING`): een databaselease
(`JobLease`, naam `compare-sync`, heartbeat, verloopt na
`COMPARE_SYNC_LEASE_MINUTES`) laat één synchronisatie tegelijk toe over alle
API-instances en werkers heen; een gecrashte run verliest de lease vanzelf.
Elke adapter krijgt een timeout en één nieuwe poging; een snapshot die meer dan
20 % van de bestaande aanbiedingen zou deactiveren, deactiveert niets (run
`PARTIAL` met note) zodat een half bestand geen geldige prijzen beschadigt.
Elke run landt in `ImportRun` (met `termsReviewed`) met tellers en fouten
zonder geheimen; HTTP-runs worden gelogd met request-id (`SyncAudit`).

Plannen: de werker (`node dist/compare/cli/worker.cli.js`, interval
`COMPARE_SYNC_INTERVAL_MINUTES`, netjes afsluiten op SIGTERM), een externe cron
op `node dist/compare/cli/sync.cli.js` of `POST /compare/internal/sync` met
`x-job-key` vanaf een server (browserverzoeken worden geweigerd).

## Tests

| Suite | Bestand | Aantal |
|---|---|---|
| geld, eenheden, normalisatie, promoties, statiegeld | `packages/pricing/src/*.test.ts` | 61 |
| productmatching | `apps/api/src/compare/matching/product-matcher.test.ts` | 19 |
| mandje | `apps/api/src/compare/basket/basket-optimizer.test.ts` | 17 |
| prijsalerts (evaluator) | `apps/api/src/compare/alerts/alert-evaluator.test.ts` | 22 |
| regelprijs en prijsstatus | `apps/api/src/compare/pricing/offer-pricing.test.ts` | 5 |
| CSV-import, demogegevens, adapterfabriek en register | `apps/api/src/compare/adapters/*.test.ts`, `demo/*.test.ts` | 19 |
| app: Belgische notatie, URL-state, lokale voorkeuren, vertalingen, veilige redirects | `apps/superette-web/src/lib/*.test.ts` | 23 |
| beveiliging en hoofdflows via HTTP (incl. duplicaat zonder ketens) | `apps/api/scripts/smoke-compare.ts` | 104 checks tegen live API |
| productiehardening: cookies, CSRF, CORS, refresh-rotatie, hergebruik, logout, export, verwijdering, jobsleutel/rotatie/lease, e-mail-outbox, rate limits, foutvorm, headers | `apps/api/scripts/smoke-auth.ts` | 94 checks tegen live API |
| cookies, logredactie, bronstatus, e-mailsjablonen, foutfilter | `apps/api/src/common/*.test.ts`, `compare/catalog/chains.controller.test.ts`, `compare/notifications/email/*.test.ts` | 23 |
| migraties: drift, lege database, bestaande boetiekdata, rollback | `apps/api/scripts/migration-test.sh` | 10 controles |
| databaselease: verwerven, weigeren, heartbeat, verlopen lease overnemen, vrijgeven, 10 gelijktijdige houders | `apps/api/scripts/smoke-lease.ts` | 13 checks tegen de database |
| app in de browser: verticale flow, filters, lijst, mandje, voorkeuren, alertpreview, duplicaat, pauzeren/hervatten/verwijderen, eigendom, melding, demodata, nl-notatie, responsive, headers/CSP + nonce-hydratie, geen token in localStorage, sessieverloop, export, accountverwijdering, axe-core op elke route | `scripts/walkthrough-superette.mjs` | ~210 checks + schermafbeeldingen |
| belasting | `scripts/loadtest.mjs` | aantal, fouten %, mediaan, p95, p99 per endpoint |
| back-up en herstel (pg_dump → lege database → rijtellingen, md5, migratiestatus) | `apps/api/scripts/backup-drill.sh` | 6 controles |
| CI-workflow lokaal (alle `run:`-stappen, zelfde omgeving) | `scripts/ci-local.mjs` | per stap PASS/FAIL |
| omgevingsvalidatie (productie weigert onveilige configuratie) | `apps/api/src/config/env.test.ts` | 9 |
| foutmonitoring (DSN, envelope, redactie, limiet) | `apps/api/src/common/error-reporter.test.ts` | 6 |
| bundel zonder geheimen | `scripts/check-bundle-secrets.mjs` | – |

```bash
npm test                                   # alle unit-tests (vat, pricing, api, web)
npm run typecheck                          # strikte TypeScript-controle (er is geen ESLint in de repo)
npm run smoke:compare                      # met draaiende API + gevulde database
COMPARE_JOB_KEY=… COMPARE_JOB_KEY_PREVIOUS=… EMAIL_OUTBOX_DIR=… npm run smoke:auth
COMPARE_JOB_KEY=… EXPECT_PRODUCTION_CSP=true npm run walkthrough:superette   # met draaiende API en app (next start)
DATABASE_ADMIN_URL=… npm run db:migrate:test
npm run loadtest                           # API gestart met TRUST_PROXY=1
npm run check:bundle                       # na npm run build -w @superette/web
```

## Een nieuwe supermarktadapter toevoegen

1. Maak `apps/api/src/compare/adapters/<keten>.adapter.ts`:
   ```ts
   export const aldiAdapter = createChainAdapter({
     key: 'aldi',
     chain: { slug: 'aldi', name: 'ALDI', websiteUrl: 'https://www.aldi.be', loyaltyCardName: null, sortOrder: 8 },
     // live: async (ctx) => …   zodra er een toegestane bron is; zet source.kind en termsReviewed
     // demo: (ctx) => …         optioneel
   });
   ```
2. Voeg hem toe aan `supermarketAdapters` in `adapter-registry.ts`.
3. Huismerken van de keten in `STORE_BRANDS` (`product-matcher.ts`) zetten.
4. Leg `data/feeds/aldi.json` neer, of laat de adapter een live bron aanspreken.
5. `npm run compare:sync -- aldi`.

Niets anders wijzigt: zoeken, vergelijken, alerts en meldingen werken keten-onafhankelijk.

## Traceerbaarheid requirements

| Requirement (opdracht) | Status | Bestanden | Tests | Beperking |
|---|---|---|---|---|
| §4 uniforme adapterstructuur, 7 ketens | volledig | `adapters/*` | `chain-adapter.test.ts` | geen live bron |
| §5 toegestane bronnen, import CSV/JSON, demo gelabeld | volledig | `feed-schema.ts`, `csv-feed.ts`, `demo-catalog.ts` | `csv-feed.test.ts`, `demo-catalog.test.ts` | juridische check per keten open |
| §6 productmodel, eenheden, centen | volledig | `schema.prisma`, `contracts/compare/product.ts` | — | inhoud kan `null` zijn |
| §7 ketens en filialen, regionale prijzen | volledig (model + demo) | `StoreLocation`, `ProductOffer.storeLocationId` | smoke | afstand nog niet berekend |
| §8 prijzen/promoties, alle types en vlaggen | volledig | `ProductOffer`, `offer-pricing.ts` | `offer-pricing.test.ts` | — |
| §9 prijsnormalisatie | volledig | `packages/pricing` | 61 tests | — |
| §10 matching, 4 types, confidence, melden, bevestigde matches | volledig | `product-matcher.ts`, `import.service.ts` | 19 tests | geen beheerscherm voor bevestigen |
| §11 zoeken, sortering, filters | volledig (API + app, URL-state) | `search.service.ts`, `apps/superette-web/src/app/zoeken` | smoke, walkthrough | afstand-sortering wacht op locatie |
| §12 productdetail | volledig | `search.service.ts`, `app/producten/[id]` | smoke, walkthrough | — |
| §13 boodschappenlijsten | volledig | `lists.service.ts`, `app/lijsten` | smoke, walkthrough | — |
| §14 mandje: 3 modi, uitlegbaar | volledig | `basket-optimizer.ts`, `components/basket-results.tsx` | 17 tests + smoke + walkthrough | bezorgkosten niet gemodelleerd |
| §15 voorkeuren (profiel + lokaal voor bezoekers) | volledig | `preferences.service.ts`, `lib/local-preferences.ts`, `app/profiel/voorkeuren` | smoke, 4 unit-tests, walkthrough | afstand doet nog niets |
| §16 prijsgeschiedenis met grafiek en tabel | volledig | `PriceHistory`, `historySummary`, `components/price-history-chart.tsx` | smoke, walkthrough | demo heeft maar één meetmoment, dus grafiek toont "te weinig meetmomenten" |
| §17–§19 alerts, datamodel | volledig | `alerts/*`, `schema.prisma`, `components/alert-form.tsx` | 22 tests + smoke + walkthrough | — |
| §20 "Mijn prijsalerts" (filters, sortering, acties) | volledig | `alerts.service.ts`, `app/alerts` | smoke, walkthrough | — |
| §21 controle en meldingen, idempotent, digest | volledig (in-app) | `alerts.service.ts`, `notifications/*`, `app/meldingen` | evaluator-tests, smoke, walkthrough | e-mail zonder provider |
| §22 auth, autorisatie, privacy | volledig | controllers + services, `register-superette`, `eraseAll` | smoke (IDOR), walkthrough (tweede gebruiker) | accountverwijdering-flow niet gekoppeld |
| §23 API-conventies | volledig | controllers | smoke | — |
| §24 periodieke verwerking | volledig | `jobs/*`, `import.service.ts` | smoke (`/internal`), walkthrough (sync → melding) | planner in één proces |
| §25 Belgische context, nl eerst, fr/en voorbereid | volledig in de app | `lib/format.ts`, `lib/messages.ts` | 23 unit-tests, walkthrough (taalwissel) | API-foutteksten alleen nl |
| §26 UX en identiteit | volledig | `globals.css`, `components/*` | walkthrough + schermafbeeldingen | — |
| §27 toegankelijkheid | basis gecontroleerd | skip-link, labels, namen, landmarks, focus, `prefers-reduced-motion`, contrast gedocumenteerd | walkthrough (per pagina), paletvalidator | geen volledige WCAG-audit met axe of schermlezer |
| §28 statussen (laden, leeg, fout, deels, offline) | volledig | `components/states.tsx`, `ui.tsx` | walkthrough (lege lijst, lege alerts, zonder account) | offline alleen als foutmelding, geen cache |
| §29 beheer | fundament | `ImportRun`, `ProductMatchReport`, `/internal/status` | — | geen adminscherm |
| §30 tests | grotendeels | zie Tests | 217 unit (hele monorepo) + 104 smoke + 107 walkthrough | geen notificatieprovider-fouttest met echte provider |
| §32 documentatie | dit bestand | — | — | — |

## Bekende beperkingen en openstaand

- **Echte data.** Alle zeven ketens draaien op demogegevens. Per keten is een
  overeenkomst of gelicentieerde feed nodig; `termsReviewed` blijft `false` tot
  een mens dat heeft nagekeken.
- **E-mail.** De transportlaag is klaar (`none`/`file`/`http`, opt-in per
  gebruiker, idempotency-key, permanente vs. tijdelijke fouten), maar er is
  geen provider gekoppeld; zonder provider blijven meldingen eerlijk in-app
  (`EMAIL_UNAVAILABLE`).
- **Afstand.** Filialen hebben coördinaten; de locatie van de gebruiker (postcode →
  coördinaten) en de afstandsberekening ontbreken, dus `maxDistanceKm` en
  "sorteren op afstand" doen nog niets.
- **Matching-pool.** Bij import wordt een nieuw product gematcht tegen hoogstens
  2000 producten uit dezelfde categorie (of dezelfde eenheid). Groot genoeg voor
  demo en eerste feeds; voor tienduizenden producten per keten is een
  zoekindex nodig.
- **Zoeken** is `contains` op genormaliseerde naam/merk, geen full-text index.
- **Accountverwijdering en export** bestaan (`DELETE /account` met wachtwoord
  en bevestigingszin, `GET /account/export`); zie `docs/PRIVACY.md` voor wat
  wordt gewist, geanonimiseerd en bewaard. De privacyverklaring (`/privacy`) is
  een voorstel dat een jurist moet goedkeuren; fr/en ontbreken.
- **Sessies** van de Superette-app lopen via HttpOnly-cookies met korte
  access-tokens en server-side intrekbare refresh-tokens (`docs/SECURITY.md`).
  De boetiek-app gebruikt nog Bearer-tokens in `localStorage` (buiten scope).
- **Toegankelijkheid**: structuur, contrast en een axe-core-scan (WCAG 2.1 A/AA
  + best practices) op elke route zitten in de doorloop; een test met een echte
  schermlezer is nog niet gedaan.
- **Offline.** De app is installeerbaar maar cachet niets; zonder server toont
  ze een duidelijke foutmelding met "Opnieuw proberen".
- **Lint.** De repo heeft geen ESLint-configuratie (ook de boetiek niet);
  `npm run typecheck` draait strikte TypeScript met `noUnusedLocals`.
- **Beheer.** Geen adminscherm; onzekere matches, mislukte imports en
  meldingsfouten zijn via de database en `/internal/status` te bekijken.
