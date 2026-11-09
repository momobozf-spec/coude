# FSBO Lead Radar Belgium

Detecteert Belgische **particuliere** vastgoedadvertenties, classificeert ze,
ontdubbelt ze en stuurt ze binnen seconden als lead naar de juiste makelaar.

Eén ding goed doen: een nieuwe advertentie van een particuliere verkoper vinden
vóór de concurrent, en alleen die doorsturen.

```text
Bronnen → Collectors → Ruwe advertenties → Normalisatie → Particulier-classificatie
        → Deduplicatie → Gebiedsmatching → Leadscore → PostgreSQL → Telegram
```

---

## In vijf minuten draaien

Je hebt Node 20+ nodig. Een database ook — kies één van de twee routes.

```bash
cd fsbo-lead-radar
npm install
cp .env.example .env
```

### Route A — met Docker (aanbevolen)

```bash
docker compose up -d db      # PostgreSQL 17 op poort 5432
npm run db:deploy            # migraties toepassen
npm run db:seed              # demo-data
```

### Route B — zonder Docker

Start een ingebedde PostgreSQL die in `.devdb/` blijft staan. Migraties en seed
draaien automatisch de eerste keer.

```bash
npm run dev:db               # laat dit venster open staan
```

### Daarna, in twee andere terminals

```bash
npm run dev                  # dashboard op http://localhost:3000/admin
npm run worker               # collectors + alerts
```

Inloggen met het wachtwoord uit `ADMIN_PASSWORD`. Laat je die leeg, dan staat het
dashboard open — dat kan alleen buiten productie en het zegt het met een banner.

> **Wil je één ronde draaien in plaats van een worker?**
> `npm run collect` haalt de bronnen op die aan de beurt zijn en stopt daarna.

---

## Wat je te zien krijgt

Na `npm run db:seed` staat er een complete markt in de database — geen decor,
maar het echte resultaat van de pijplijn over verzonnen advertenties:

| | |
|---|---|
| advertenties | 38 |
| particulier / makelaar / onbekend | 16 / 22 / 0 |
| cross-source duplicaat | 1 (herkend met 93% zekerheid) |
| makelaars | 4 (waarvan 1 inactief) |
| abonnementen | actief, gepauzeerd én opgezegd |
| alerts | 9, in dry-run vastgelegd |

Zonder `TELEGRAM_BOT_TOKEN` verstuurt het systeem niets. De alerts worden wél
volledig aangemaakt en gelogd, met status `SUPPRESSED_DRY_RUN`. Zo controleer je
de hele keten zonder een bot aan te maken — en het dashboard toont die telling
apart, zodat een lege "verzonden"-teller niet op een storing lijkt.

### Telegram echt aanzetten

1. Maak een bot bij [@BotFather](https://t.me/botfather) en kopieer het token.
2. Zet `TELEGRAM_BOT_TOKEN=...` in `.env`.
3. Stuur je bot een bericht en haal je chat-id op via
   `https://api.telegram.org/bot<TOKEN>/getUpdates`.
4. Vul dat id in bij de makelaar onder **/admin/agencies**.

---

## Commando's

| | |
|---|---|
| `npm run dev` | dashboard in ontwikkelmodus |
| `npm run worker` | collectors, alerts en opruiming; blijft draaien |
| `npm run collect` | één ronde, dan stoppen |
| `npm run dev:db` | ingebedde PostgreSQL zonder Docker |
| `npm run db:migrate` | migratie maken en toepassen |
| `npm run db:deploy` | migraties toepassen (productie) |
| `npm run db:seed` | demo-data |
| `npm run db:studio` | Prisma Studio |
| `npm run verify` | schema + typecheck + lint + tests |
| `npm test` | alleen de tests |
| `npm run build` | productiebuild |

---

## Het dashboard

Bereikbaar op `/admin`, beschermd door `ADMIN_PASSWORD`.

- **Dashboard** — leads vandaag, particuliere leads, verzonden alerts,
  duplicaten, bronstatus en de laatste collector-runs.
- **Advertenties** — filteren op bron, postcode, verkoop/huur, verkopertype,
  status, minimumscore en datumbereik. Per advertentie zie je waarom de
  classificatie besliste zoals ze besliste (hover over de badge).
- **Makelaars** — kantoren, hun Telegram chat-id, werkgebieden (postcode,
  gemeente, provincie of straal) en abonnementen met hun eigen drempels.
- **Bronnen** — aan/uit, interval, rate limit, timeout, retries, gezondheid,
  cooldown en de laatste runs per bron.

---

## Over bronnen, en wat dit systeem niet doet

De MVP komt met drie collectors:

| sleutel | wat het is | netwerk |
|---|---|---|
| `fixture-be` | leest `fixtures/listings.json` | nee |
| `demo-be` | genereert plausibele Belgische advertenties | nee |
| `jsonld-feed` | referentie: sitemap + schema.org, **staat uit** | ja, indien toegestaan |

**Er zit geen enkele omzeiling van toegangscontroles in.** Geen CAPTCHA-solvers,
geen proxy-rotatie, geen fingerprint-spoofing, geen genegeerde 403's. Elke
uitgaande request loopt door één `HttpClient` die eerst `robots.txt` raadpleegt,
zich aan `Crawl-delay` houdt, per host rate-limit en zich met een
identificeerbare User-Agent meldt. Krijgt een bron ons niet graag — 403, een
challenge-pagina, een verbod in robots.txt — dan is dat een antwoord: de bron
gaat in cooldown en, bij herhaling, uit.

`jsonld-feed` is werkende code, geen schets, maar hij weigert te draaien zolang
`FEED_COLLECTOR_HOSTS` leeg is. Dat is opzet: robots.txt zegt wat een crawler
technisch mag ophalen, maar niets over wat de gebruiksvoorwaarden van die site
toestaan met de gegevens, en al helemaal niets over het doorsturen van
contactgegevens van particulieren aan makelaars. Die afweging kan software niet
maken. Zie **[docs/ADDING-A-SOURCE.md](docs/ADDING-A-SOURCE.md)**.

De dubbele schakelaar: een bron draait alleen als hij én in de database
`enabled` is, én in `COLLECTOR_ENABLED_SOURCES` staat. De env-variabele ligt bij
wie de omgeving deployt, het vinkje bij wie de dienst bedient.

---

## Particulier of makelaar — de kern

Dit is de duurste beslissing in het systeem. Een doorgestuurde makelaar kost het
vertrouwen van de klant; een gemiste particulier kost hem een opdracht.

De MVP gebruikt een **regelmotor**, geen model: uitlegbaar (het dashboard toont
letterlijk waarom), goedkoop, en aanpasbaar zonder hertrainen. Signalen worden
gecombineerd met noisy-or en de twee kanten worden van elkaar afgetrokken; bij
tegenspraak volgt `unknown` en gaat er niets uit.

De belangrijkste regel in de hele motor is de omgang met **ontkenning**. Het
sterkste particuliere signaal in Belgische advertenties is letterlijk
"zonder makelaar" — en dat bevat het sterkste professionele woord. Zonder die
regel bewijst elke echte FSBO-advertentie tegelijk beide kanten en haalt ze de
verzenddrempel niet. (In de demo-data scheelde het 8 versus 14 gekwalificeerde
leads.)

Alleen leads met `type === 'private'` én een zekerheid boven
`PRIVATE_CONFIDENCE_THRESHOLD` (standaard 0,85) gaan automatisch de deur uit.

---

## Leadscore

0–100, opgebouwd uit benoemde componenten die het dashboard toont:

```text
particuliere verkoper   0–40   schaalt met de zekerheid
telefoonnummer          0/20
versheid                0–20   < 10 min = 20
gebiedsmatch            0–10   exact > gemeente > straal > provincie
volledigheid            0–10
                       ─────
                         100

prijsrange            −12–0    aftrek
duplicaat               −30
herplaatsing            −12
```

De som komt precies op 100 uit. Zou hij erboven liggen, dan snijdt de afkapping
juist de verschillen weg tussen leads die onderscheiden moeten worden.

---

## Persoonsgegevens

De dienst verzamelt contactgegevens van mensen die daar niet om gevraagd hebben.
Daarom:

- Elke advertentie is herleidbaar: **welke bron, wanneer voor het eerst gezien,
  wanneer voor het laatst, en de originele URL.**
- Naam en telefoon staan bij elkaar in `Seller`, niet verspreid over rijen, zodat
  één handeling genoeg is om ze te wissen.
- `purgeExpiredData()` ruimt automatisch op: ruwe bronpayloads na
  `RETENTION_RAW_PAYLOAD_DAYS` (14), advertenties na
  `RETENTION_LISTING_DAYS` (90) zonder waarneming. De worker draait dit elk uur.
- `redactSeller(id, actor)` wist de gegevens van één persoon — ook uit de
  beschrijvingen van zijn advertenties en uit al verstuurde alertteksten.
- `deleteListing(id, actor)` verwijdert één advertentie volledig.
- Belangrijke handelingen komen in `AuditLog`.

Zie [`src/services/dataRetentionService.ts`](src/services/dataRetentionService.ts).

---

## Beveiliging

- Secrets uitsluitend via environment variables; niets in de broncode.
- `.env` staat in `.gitignore`; `.env.example` is de gedeelde versie.
- Alle omgevingsvariabelen worden bij het opstarten met Zod gevalideerd — een
  verkeerd getypte drempel laat de app falen in plaats van stilletjes elke
  advertentie door te sturen.
- `/admin` is beschermd; het sessiecookie is HMAC-ondertekend, httpOnly,
  SameSite=Lax en verloopt. In productie weigert de app te starten zonder
  `ADMIN_PASSWORD` en `SESSION_SECRET`.
- Elke server action begint met `requireAdmin()` — een action is een POST naar
  een publiek endpoint, dus de knop op een beveiligde pagina is geen bescherming.
- Alle invoer (formulieren, querystrings, collectoruitvoer) loopt door Zod.
- Query's gaan via Prisma; geen string-geconcateneerde SQL.
- Gestructureerde JSON-logging met redaction van tokens, wachtwoorden, chat-id's
  en telefoonnummers — geregeld in de logger, niet op de call-sites.
- Beveiligingsheaders (CSP, HSTS, X-Frame-Options, …) op elke response.
- `POST /api/cron/collect` bestaat alleen met `CRON_SECRET` en geeft anders 404
  in plaats van 401 — een 401 zou verklappen dat het endpoint er is.

---

## Tests

```bash
npm test        # 191 tests
```

Gedekt: normalisatie (Belgische prijsnotatie, postcodes, telefoonnummers),
verkoperclassificatie inclusief ontkenning, deduplicatie, leadscore,
gebiedsmatching, notificatie-deduplicatie en berichtopbouw, collector-parsing
(fixtures, JSON-LD, sitemaps, robots.txt), en de hulpmodules.

**Geen enkele test raakt een externe site.** Alles draait op lokale
HTML/JSON-fixtures.

---

## Verder lezen

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — de indeling en de afwegingen erachter
- **[docs/ADDING-A-SOURCE.md](docs/ADDING-A-SOURCE.md)** — een nieuwe bron toevoegen

---

## Tech

Next.js 16 · TypeScript strict · PostgreSQL 17 · Prisma 6 · Tailwind 4 · Zod 4 ·
Vitest · Telegram Bot API · Docker Compose

Playwright zit er bewust **niet** in: geen enkele collector in de MVP heeft een
browser nodig, en de afhankelijkheid kost honderden megabytes plus seconden per
run. Zie ADDING-A-SOURCE.md voor wanneer dat wél gerechtvaardigd is.
