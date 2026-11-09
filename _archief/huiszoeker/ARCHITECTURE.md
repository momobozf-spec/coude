# AI Huiszoeker — Architectuur (Fase 1)

Dit document is het ontwerp waar de rest van de implementatie zich aan houdt.
Het legt vooral de *waarom* vast; de *hoe* staat in de code.

---

## 1. Technologiekeuzes en motivatie

| Laag | Keuze | Waarom |
|---|---|---|
| Runtime | Node.js 20+, TypeScript strict, **ESM** | Sluit aan bij de rest van deze repo (`engines.node >= 20`). |
| HTTP | **Fastify 5** | Native Pino-logging (spec vraagt Pino), `@fastify/rate-limit` en `@fastify/helmet` als first-party plugins, en per-route schemavalidatie. Met Express zouden we die vier dingen los bij elkaar moeten sprokkelen. |
| DB | PostgreSQL + Prisma 6 | Prisma is de conventie in deze repo. Postgres omdat we `String[]`-kolommen (features), partial indexes en `JSONB` nodig hebben. |
| Validatie | **Zod als enige bron van waarheid** | De TS-types worden *afgeleid* uit de Zod-schema's (`z.infer`), niet los gedefinieerd. Eén definitie kan niet uit elkaar lopen. Hetzelfde schema wordt via `zod-to-json-schema` doorgegeven aan het LLM als output-schema — de AI krijgt dus letterlijk het contract waarop we valideren. |
| AI | Adapter met **Anthropic** (default) en **OpenAI** | Beide achter één `AiProvider`-interface, gekozen via `AI_PROVIDER`. Anthropic is default omdat deze repo al `@anthropic-ai/sdk` gebruikt. |
| Scheduler | **node-cron** + DB-lock | Zie §5. Geen Redis nodig voor v1; BullMQ kan later achter dezelfde `JobQueue`-interface geschoven worden. |
| Scraping | Axios + Cheerio, Playwright alleen als het écht moet | Playwright kost ~300 MB en seconden per run. Elke scraper declareert `requiresBrowser`; de registry start alleen een browser als minstens één actieve bron er om vraagt. |
| Logging | Pino, structured, met redaction | `redact` op `*.authorization`, `*.token`, `*.apiKey` staat in de logger-config, niet in call-sites. Vergeten redacten wordt dan onmogelijk. |
| Tests | Vitest | Conventie in deze repo (`superette`). |

### Twee kleine keuzes die veel bugs schelen

**Prijzen zijn `Int` in hele euro's.** Niet `Float`, niet centen.
Vastgoedadvertenties noteren nooit centen, en `Float` gaat drift geven zodra we
prijshistoriek diffen (`450000.0 !== 449999.99999`) of matchscores berekenen.
De zustertoepassing `superette` gebruikt centen omdat daar BTW over gerekend
wordt; hier is dat niet zo, en hele euro's houden de API identiek aan wat de
gebruiker intypt.

**`Property` is globaal, niet per gebruiker.** Eén woning bestaat één keer in de
database, ongeacht hoeveel gebruikers hem vinden. De per-gebruiker-relatie zit in
`SearchMatch`. Dat is meteen de multi-user-ready vorm: 500 gebruikers die
allemaal "huis Gent" zoeken, scrapen niet 500× dezelfde pagina en slaan niet
500× dezelfde rij op.

---

## 2. Juridische en technische realiteit van de bronnen

Dit is **geen formaliteit** — het bepaalt hoe de scrapers gebouwd zijn.

### Immoweb

`https://www.immoweb.be/robots.txt` verbiedt onder andere:

```
Disallow: *maxprice*
Disallow: *minprice*
Disallow: *orderBy*
Disallow: *searchByRooms*
Disallow: *searchId*
Disallow: */nl/geavanceerd-zoeken/*
```

Dat zijn precies de query-parameters die een "zoek met filters"-scraper zou
gebruiken. **Een criteria-gestuurde zoek-URL op Immoweb is dus door robots.txt
verboden.** Wat wel toegestaan is: de sitemap en de pad-gebaseerde
zoekertjespagina's (`/nl/zoekertjes/huis/te-koop/gent/9000`) plus de
detailpagina's.

Gevolg voor het ontwerp: de Immoweb-adapter bouwt **pad-gebaseerde** zoek-URL's
en laat prijs-/slaapkamerfilters over aan onze eigen matching engine. Dat is
geen omweg — §8 van de opdracht vroeg sowieso al om niet op de filters van de
site te vertrouwen. De robots.txt duwt ons dus in de architectuur die je al wilde.

### Zimmo

`https://www.zimmo.be/robots.txt` was vanaf hier niet op te halen (de host
weigert geautomatiseerde requests). Dat is op zichzelf een antwoord: Zimmo zit
achter bot-detectie. De adapter wordt gebouwd, maar staat **standaard uit** en
schakelt zichzelf uit zodra robots.txt of een 403 zegt dat het niet mag.

### Wat dit betekent voor de code

1. **`RobotsPolicy` is een echte poort, geen decoratie.** Elke uitgaande request
   loopt erlangs. Hij haalt `robots.txt` op per host, cachet die, en gooit een
   `RobotsDisallowedError` bij een verboden pad. Voor Immoweb zal hij een naïeve
   `?maxprice=`-URL daadwerkelijk blokkeren — dat is de bedoeling.
2. **Bronnen staan standaard uit.** `SCRAPER_ENABLED_SOURCES` is een expliciete
   allowlist. Jij zet een bron aan, en daarmee is de afweging over de
   gebruiksvoorwaarden (die los staan van robots.txt) jouw beslissing en niet
   een verstopte default van mij.
3. **Geen enkele omzeiling.** Geen CAPTCHA-solvers, geen stealth-plugins, geen
   roterende proxies, geen fingerprint-spoofing. Krijgt een scraper een 403 of
   een challenge, dan logt hij `SCRAPER_BLOCKED`, zet zichzelf uit voor een
   cooldown-periode en stopt.
4. **Een `fixture`-bron hoort bij de standaard-set.** Die leest lokale
   HTML/JSON-snapshots. Daarmee is de hele pijplijn — normaliseren, dedupliceren,
   matchen, AI, notificeren — te draaien en te testen zonder ook maar één
   externe request. Dat maakt de tests deterministisch en de demo mogelijk
   zonder dat je iets aanzet.

Rate limiting per host (`SCRAPER_REQUESTS_PER_MINUTE`, default 20),
`Crawl-delay`-respect, een identificeerbare User-Agent met contact-URL, timeouts
en exponentiële backoff zitten in de gedeelde `HttpClient`, niet per scraper.

---

## 3. Mappenstructuur

Zoals gebouwd na fase 3. `src/scrapers/` uit het oorspronkelijke plan heet
`src/sources/`: scraping is één manier om aan advertenties te komen, niet de
manier waar we op willen leunen (zie §4).

```text
huiszoeker/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── fixtures/
│   └── listings.json                # offline advertenties voor dev + tests
├── src/
│   ├── api/
│   │   ├── routes/                  # searches.ts, health.ts
│   │   ├── middleware/              # auth.ts (RequestUserContext), errorHandler.ts
│   │   ├── context.ts               # RequestUserContext
│   │   ├── presenters.ts            # domeinrecord → API-DTO
│   │   └── app.ts                   # buildApp() — testbaar zonder poort
│   ├── ai/
│   │   ├── providers/               # anthropicProvider, openaiProvider, index (factory)
│   │   ├── prompts/searchParser.ts
│   │   ├── normalizeCriteria.ts     # deterministische opschoning van modeloutput
│   │   ├── searchParser.ts
│   │   └── propertySummarizer.ts    # ── fase 4
│   ├── sources/
│   │   ├── base/
│   │   │   ├── BaseSource.ts        # ophalen ↔ normaliseren gescheiden
│   │   │   ├── HttpClient.ts        # robots, rate limit, timeout, retry/backoff
│   │   │   ├── RobotsPolicy.ts
│   │   │   └── jsonld.ts            # schema.org-extractie
│   │   ├── immoweb/                 # urls.ts, normalize.ts, immowebSource.ts
│   │   ├── zimmo/                   # voorbereid, standaard uit
│   │   ├── fixture/
│   │   ├── types.ts                 # PropertySource, SourceKind, SourceSearchContext
│   │   └── registry.ts
│   ├── services/
│   │   ├── searchService.ts         # CRUD, parsing, vergrendeling
│   │   ├── searchRunner.ts          # de pijplijn van §5
│   │   ├── matchingService.ts
│   │   ├── enrichmentService.ts     # ── fase 4
│   │   └── notificationService.ts   # ── fase 4
│   ├── notifier/                    # ── fase 4
│   ├── scheduler/                   # ── fase 4
│   ├── db/
│   │   ├── prisma.ts
│   │   └── repositories/
│   │       ├── interfaces.ts        # waar de services op leunen
│   │       └── prisma/              # de implementaties
│   ├── schemas/
│   │   ├── searchCriteria.ts        # bron van waarheid
│   │   ├── property.ts
│   │   └── api.ts
│   ├── config/env.ts                # Zod-gevalideerde env, faalt bij opstart
│   ├── lib/                         # logger, errors, events, url, epc, fingerprint
│   ├── types/                       # domain.ts, matching.ts, notification.ts, ai.ts
│   ├── generated/prisma/            # gegenereerd, niet in git
│   ├── cli/index.ts
│   └── server.ts
├── tests/
│   ├── helpers/                     # in-memory repositories, stub-AI-provider
│   ├── searchParser.test.ts  searchService.test.ts  api.test.ts
│   └── matching.test.ts  sources.test.ts  searchRunner.test.ts
├── tsconfig.json                    # build (alleen src/)
├── tsconfig.check.json              # typecheck (src + tests + prisma + root)
├── Dockerfile / docker-compose.yml  # ── fase 5
└── .env.example
```

Regel voor ESM: relatieve imports krijgen een `.js`-extensie
(`import { env } from "../config/env.js"`). Dat is wat `moduleResolution:
"NodeNext"` eist; zonder extensie compileert het wel maar crasht het bij runtime.

---

## 4. Kerncontracten

Alles hieronder staat in `src/schemas/` en `src/types/` als code. Kort:

```ts
type SourceKind = "scrape" | "api" | "feed" | "sitemap" | "partner" | "manual" | "fixture";

interface PropertySource {
  readonly name: string;
  readonly kind: SourceKind;
  readonly requiresBrowser: boolean;
  supports(criteria: SearchCriteria): boolean;   // bv. bron dekt enkel Vlaanderen
  search(criteria: SearchCriteria, ctx: SourceSearchContext): Promise<PropertyListing[]>;
}

// BaseSource implementeert `search` definitief en splitst hem in twee stappen,
// zodat ophalen en normaliseren nooit door elkaar lopen:
abstract class BaseSource implements PropertySource {
  protected abstract fetchRaw(criteria, ctx): Promise<RawListing[]>;  // netwerk, mag falen
  protected abstract normalizeOne(raw: RawListing): unknown;          // puur, synchroon, testbaar
}

interface AiProvider {
  readonly name: "anthropic" | "openai";
  complete<T>(req: StructuredRequest<T>): Promise<T>;  // JSON-schema in, Zod-gevalideerd uit
}

interface Notifier {
  readonly channel: NotificationChannelType;
  send(notification: PropertyNotification): Promise<void>;
}
```

`search` en `normalize` zijn bewust gesplitst. Zo kan een test een opgeslagen
HTML-snapshot door `normalize` halen zonder netwerk, en dat is precies de test
die §19 vraagt ("resultaten van verschillende scrapers moeten hetzelfde
`PropertyListing`-formaat opleveren").

---

## 5. Workflow

```text
                    ┌─────────────────────────────┐
   node-cron  ─────▶│ propertySearchScheduler     │
   (elk kwartier)   │ selecteert searches waarvan │
                    │ nextRunAt <= now            │
                    └──────────────┬──────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ claimSearch()      │  atomische UPDATE ... WHERE
                         │ lockedAt = now     │  lockedAt IS NULL OR < now-TTL
                         └─────────┬──────────┘  0 rijen geraakt ⇒ draait al ⇒ skip
                                   │  SEARCH_STARTED
                    ┌──────────────▼───────────────┐
                    │ registry.resolve(criteria)   │  actieve + supports() bronnen
                    └──────────────┬───────────────┘
                                   │  SCRAPER_STARTED (per bron, parallel)
                    ┌──────────────▼───────────────┐
                    │ scraper.search() → RawListing│  robots-check, rate limit, retry
                    │ scraper.normalize()          │  SCRAPER_COMPLETED / SCRAPER_BLOCKED
                    └──────────────┬───────────────┘
                                   │  PROPERTY_FOUND
                    ┌──────────────▼───────────────┐
                    │ propertyService.upsert()     │  dedup: (source,externalId)
                    │                              │  → urlNormalized → fingerprint
                    │  nieuw?   PROPERTY_NEW       │
                    │  bestaand + veld gewijzigd?  │  → PropertyHistory-rij
                    │  ongewijzigd?                │  PROPERTY_DUPLICATE
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ matchingService.evaluate()   │  harde eisen → pass/fail
                    │                              │  voorkeuren → score 0-100
                    └──────────────┬───────────────┘
                                   │  MATCH_FOUND
                    ┌──────────────▼───────────────┐
                    │ SearchMatch upsert           │  unique(searchId, propertyId)
                    │ nieuw, óf prijs gedaald?     │  → in aandacht-lijst
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ enrichmentService (AI)       │  enkel voor te melden matches
                    │ samenvatting uit ALLEEN de   │  (kosten: geen AI-call voor
                    │ opgeslagen velden            │   panden die niemand ziet)
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ notificationService          │  1 match → los bericht
                    │ → notifierFactory per kanaal │  meerdere → digest
                    └──────────────┬───────────────┘
                                   │  NOTIFICATION_SENT / NOTIFICATION_FAILED
                    ┌──────────────▼───────────────┐
                    │ finishRun(): lastRunAt,      │  in finally-blok, óók bij fout
                    │ nextRunAt, lockedAt = null   │
                    │ SearchRun.status/stats       │
                    └──────────────────────────────┘
                                   SEARCH_COMPLETED
```

### Waarom een DB-lock en geen advisory lock of Redis

`pg_advisory_lock` hangt aan een *connectie*; met Prisma's connectiepool weet je
niet welke connectie je krijgt en lekt de lock bij een pool-reset. Een
voorwaardelijke `updateMany` op `Search.lockedAt` is atomair in één statement,
werkt over meerdere instanties, en geneest zichzelf: een lock ouder dan
`SEARCH_LOCK_TTL_MINUTES` (default 30) wordt overgenomen, dus een gecrashte
worker blokkeert een zoekopdracht niet voor eeuwig. Geen extra infrastructuur.

`SearchRun` is puur de audittrail (wat draaide wanneer, wat kwam eruit, welke
fout) — niet het slot zelf.

---

## 6. Matching: harde eisen versus voorkeuren

De criteria hebben een geneste vorm: scope bovenaan (`transactionType`,
`locations`, `postalCodes`, `radiusKm` — altijd hard), en daaronder
`hardRequirements` en `preferences` met exact dezelfde velden.

Dat is bewust géén platte lijst met een `hard: [...]`-array. De geneste vorm
mapt één-op-één op de taal van de gebruiker — "moet", "minstens", "maximaal"
tegenover "liefst", "bij voorkeur", "graag" — en dwingt het model niet elk veld
twee keer te noemen. Dat scheelt een hele klasse fouten.

Faalt één harde eis, dan is het geen match (`hardPass: false`) en wordt er niet
gemeld. Slagen alle harde eisen, dan is de score het gewogen aandeel gehaalde
voorkeuren. Een pand van €415.000 met alles behalve een garage komt zo als
"94%" binnen in plaats van weggefilterd te worden — precies het scenario uit §8.

**Onbekend ≠ onwaar.** Als een advertentie geen EPC vermeldt, faalt de
EPC-voorkeur niet; hij telt niet mee in de noemer, en de reden wordt vastgelegd
als `unknown`. Anders straffen we karige advertenties af in plaats van slechte
panden. Bij een *harde* eis is onbekend wél een fail — daar is de gebruiker
expliciet over geweest.

Elke uitkomst levert een `MatchReason[]` op (`{ field, verdict, detail }`). Die
lijst is wat de melding toont én wat de AI als enige input krijgt voor de
"waarom interessant"-tekst.

---

## 7. AI: waar het model wel en niet mag beslissen

| Taak | Model | Vangnet |
|---|---|---|
| Vrije tekst → `SearchCriteria` | ja | Zod-validatie op de output; bij faal één retry met de foutmelding erbij, daarna een 422 met de reden. Nooit een half ingevuld object opslaan. |
| Samenvatting van een match | ja | Krijgt uitsluitend de opgeslagen `Property`-velden en de `MatchReason[]` mee — geen vrije webtoegang, geen ruwe HTML. |
| Beslissen óf iets een match is | **nee** | Dat doet `matchingService`, deterministisch en testbaar. |
| Prijzen, oppervlaktes, EPC afleiden | **nee** | Dat doet de scraper-normalisatie uit gestructureerde velden. |

Het model beschrijft dus alleen wat de deterministische laag al heeft
vastgesteld. Daarmee kan het geen eigenschappen verzinnen die niet in de
advertentie stonden: die staan simpelweg niet in zijn input.

---

## 8. SaaS-klaar zonder overengineering

Wat er nu al in zit omdat het later niet meer te repareren is:

- Elke rij hangt aan een `userId`; elke repository-methode neemt `userId` als
  argument. Multi-tenant filtering achteraf inbouwen betekent elke query
  aanraken.
- `NotificationChannel` staat in de database (per gebruiker: chat-id,
  e-mailadres, webhook-URL), niet in env. Alleen de *provider*-secrets
  (bot-token, API-key) blijven in env, want die horen bij de installatie.
- `SearchMatch.status` (`NEW`/`SEEN`/`FAVOURITE`/`REJECTED`) bestaat vanaf dag
  één, zodat "favorieten" en "afwijzen" uit §24 later alleen een endpoint zijn.

Wat er bewust **nog niet** in zit: auth (v1 draait op één seed-gebruiker via
`DEFAULT_USER_EMAIL`, met een `auth`-middleware die nu die gebruiker teruggeeft
en later een JWT verifieert), facturatie, en een frontend.
