# Architectuur

Dit document legt de *waarom* vast. De *hoe* staat in de code, waar de
belangrijkste beslissingen bij de betreffende functie zijn toegelicht.

---

## 1. De pijplijn

```text
  Bron (API / feed / JSON-LD / HTML / fixture)
    │
    ▼  collectors/          RawListing[]  — zo dicht mogelijk bij wat de bron zei
  ┌────────────────────────────────────────────────────────────────┐
  │ services/ingestionService.ts — per advertentie, niet per batch  │
  ├────────────────────────────────────────────────────────────────┤
  │  1. normalizeListing()      prijs, postcode, telefoon, hashes   │
  │  2. upsertSeller()          verkoper opzoeken op telefoonnummer │
  │  3. classifySeller()        particulier / makelaar / onbekend   │
  │  4. findBestDuplicate()     cross-source, met confidence        │
  │  5. bestTerritoryMatch()    postcode > gemeente > straal > prov.│
  │  6. calculateLeadScore()    0–100, uit benoemde componenten     │
  │  7. prisma.listing.create() + ListingHistory                    │
  │  8. dispatchLead()          per abonnement, met dedupe-sleutel  │
  └────────────────────────────────────────────────────────────────┘
    │
    ▼  Telegram
```

**Waarom per advertentie en niet per batch.** Batchverwerking zou sneller zijn,
maar dit product verkoopt snelheid *per lead*, niet doorvoer. Een advertentie die
als eerste binnenkomt hoort meteen de deur uit te gaan, niet te wachten tot de
andere 49 uit dezelfde run verwerkt zijn. En één onparseerbare advertentie mag de
andere 49 niet meenemen — elke advertentie heeft daarom zijn eigen try/catch en
de run wordt `PARTIAL` in plaats van `FAILED`.

**Waarom de verkoper vóór de classificatie wordt opgezocht.** Het sterkste
signaal dat we hebben zonder externe registers is *hoeveel advertenties deze
verkoper gelijktijdig heeft*. Dat weet alleen de database. Een naam die bij de
eerste advertentie particulier leek, is bij de vijfde een kantoor.

---

## 2. Mappenindeling

```text
src/
  app/            Next.js App Router — dashboard, login, API-routes
  components/     de handvol UI-bouwstenen + weergaveformattering
  domain/         pure logica: normalisatie, classificatie, dedup, score, geo
  collectors/     bronnen + het gedeelde HTTP/robots/rate-limit-fundament
  services/       de pijplijn, alerts, statistieken, bewaartermijnen, audit
  repositories/   alle database-toegang, per aggregaat gebundeld
  jobs/           scheduler, worker, CLI
  notifications/  Telegram-client en berichtopbouw
  lib/            env, logger, errors, hash, tekst, telefoon, getallen, tijd
```

**`domain/` is puur en blijft puur.** Geen Prisma, geen `fetch`, geen klok
behalve wat er wordt ingegeven. Een ESLint-regel dwingt dit af
(`no-restricted-imports` op `src/domain/**`). De reden is niet netheid maar
testbaarheid: de classificatie, de deduplicatie en de scoring zijn de drie
plekken waar fouten geld kosten, en ze zijn nu alledrie op tafel te testen
zonder database.

**`repositories/` is de enige laag die Prisma aanraakt.** Componenten mogen dat
niet — ook daarvoor staat een lint-regel.

---

## 3. Technologiekeuzes

| Laag | Keuze | Waarom |
|---|---|---|
| Framework | Next.js 16 | Dashboard en API in één project; server components houden persoonsgegevens op de server. |
| Database | PostgreSQL 17 | Nodig voor `String[]`-kolommen, partial indexes, `JSONB` en de atomaire claim in §5. |
| ORM | Prisma 6 | Conventie in deze repository; typeveilige query's. |
| Validatie | Zod 4 | Eén schema per grens; types worden afgeleid, niet los onderhouden. |
| Scraping | `fetch` + Cheerio | Geen browser nodig in de MVP. Zie §6. |
| Scheduler | eigen lus + DB-claim | Zie §5. |
| Logging | eigen JSON-logger | Redaction in de logger, niet op de call-sites. |
| Tests | Vitest | Conventie in deze repository. |

### Twee kleine keuzes die veel bugs schelen

**Prijzen zijn `Int` in hele euro's.** Niet `Float`, niet centen.
Vastgoedadvertenties noteren nooit centen, en een `Float` gaat driften zodra we
prijswijzigingen diffen (`329000.0 !== 328999.99999`).

**De Belgische getalnotatie staat op één plek.** `lib/number.ts`. Punt is
duizendtalscheiding, komma is decimaalteken — omgekeerd aan de Angelsaksische.
Wie dat fout doet leest "329.000" als 329 euro. Die regel stond eerst op twee
plekken (prijsparser en JSON-LD-lezer) en liep meteen uiteen; nu niet meer.

---

## 4. Particulier versus makelaar

Zie [`src/domain/classification/`](src/domain/classification/).

Regels, geen model. Uitlegbaar, goedkoop, aanpasbaar zonder hertrainen — en het
dashboard kan letterlijk tonen waarom er besloten is zoals er besloten is.

**Bewijs optellen met noisy-or**, niet met een som:

```text
gecombineerd = 1 − Π(1 − gewicht_i)
```

Twee onafhankelijke aanwijzingen van 0,5 geven samen 0,75, en niets komt ooit
boven 1. Een som zou drie zwakke signalen zwaarder laten wegen dan één sluitend
bewijs.

Daarna worden de twee kanten van elkaar afgetrokken. Ligt het verschil binnen
±0,15, dan volgt `unknown` en gaat er niets uit. Een advertentie die tegelijk
"zonder makelaar" zegt en een BIV-nummer draagt hoort niet met overtuiging de
verkeerde kant op te vallen.

### De belangrijkste regel: ontkenning

Het sterkste particuliere signaal in Belgische advertenties is letterlijk
**"zonder makelaar"** — en dat bevat het sterkste professionele woord. Hetzelfde
geldt voor "geen makelaarskosten", "geen immokantoor", "sans agence".

`stripNegatedAgencyMentions()` knipt ontkende makelaarsvermeldingen uit de tekst
vóórdat de professionele patronen erop losgelaten worden; de particuliere
patronen draaien op de onbewerkte tekst. Zonder die stap bewijst elke echte
FSBO-advertentie tegelijk beide kanten, komt ze op `unknown` of op een lage
zekerheid uit, en gaat precies de lead waarvoor de dienst bestaat níet de deur
uit. In de demo-data was het verschil 8 versus 14 gekwalificeerde leads.

De prijs: een kantoor dat schrijft "wij zijn geen gewoon vastgoedkantoor"
verliest één signaal. Bewuste ruil — dat is zeldzaam, en zo'n kantoor valt
alsnog door de mand op zijn naam, zijn BIV-nummer of zijn aantal advertenties.

### "Onbekend" is geen bewijs

Een bron die niets over de verkoper zegt levert géén signaal, in geen van beide
richtingen. Nul bekende advertenties is niet hetzelfde als één advertentie;
`resolveListingCount()` geeft daarom `null` in plaats van `0`.

---

## 5. Scheduling

Geen Redis, geen BullMQ. PostgreSQL kan atomair claimen, en dat is het enige wat
een wachtrij hier zou doen:

```ts
const result = await prisma.source.updateMany({
  where: { id, enabled: true, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
  data: { lockedUntil, lockedBy: workerId },
})
if (result.count === 1) { /* wij hebben hem */ }
```

Twee workers die op dezelfde milliseconde beginnen doen beiden deze UPDATE, en
PostgreSQL laat er precies één slagen. Was dit een SELECT gevolgd door een
UPDATE, dan zouden beide workers dezelfde advertenties verwerken.

De vorm is wél die van een wachtrij, met een expliciete claim en een verlopende
lock. Groeit het aantal bronnen zo dat één proces het niet trekt, dan is de stap
naar meerdere workers gratis, en de stap naar BullMQ een implementatiedetail
achter dezelfde `tick()`.

**Niet blokkeren.** Elke tick claimt maximaal `COLLECTOR_CONCURRENCY` bronnen en
draait ze met `Promise.allSettled`. Eén trage bron houdt de andere niet tegen.

**Failure isolation** zit in `recordFailure()`:

| opeenvolgende fouten | gezondheid | cooldown |
|---|---|---|
| 1–2 | `DEGRADED` | geen — een dip mag |
| 3–4 | `FAILING` | exponentieel groeiend |
| 5+ | `BLOCKED` | volledige cooldown-periode |

Een robots-verbod, een 403 of een configuratiefout springt meteen naar het einde
van de ladder: dat is geen storing die overgaat, en opnieuw proberen zou precies
het gedrag zijn dat we niet willen vertonen.

---

## 6. Bronnen, en de grens

Elke uitgaande request loopt door één `HttpClient`
([`src/collectors/base/httpClient.ts`](src/collectors/base/httpClient.ts)) en
krijgt daarmee automatisch: robots.txt-controle, rate limiting per host (token
bucket, niet een teller per minuut), timeout, begrensde retries met
exponentiële backoff en jitter, een identificeerbare User-Agent en een logregel.
Een collector die zelf `fetch` aanroept omzeilt dat allemaal — vandaar dat de
collector-interface geen `fetch` doorgeeft maar deze client.

**Wat er met opzet niet in zit:** proxy-rotatie, fingerprint-spoofing,
CAPTCHA-oplossers, stealth-plugins, genegeerde 403's.

Er zit wél herkenning van challenge-pagina's in, en dat is geen omzeiling maar
het tegendeel: zonder die herkenning zou een collector de challenge-pagina als
"de advertentiepagina" parsen, nul resultaten rapporteren en groen blijven,
terwijl de bron ons in werkelijkheid weigert. Dat willen we juist zien.

**robots.txt is een poort, geen decoratie.** Faalt het ophalen ervan, dan gaan we
niet door: niet weten of iets mag is geen toestemming. Alleen een expliciete 404
telt als toestemming, want dat schrijft de standaard voor.

**Playwright zit er niet in.** Geen enkele collector in de MVP heeft een browser
nodig. De afhankelijkheid kost honderden megabytes en seconden per run; hem
toevoegen "voor het geval dat" zou elke run duurder maken zonder dat er iets
tegenover staat. Wanneer het wél mag, staat in
[docs/ADDING-A-SOURCE.md](docs/ADDING-A-SOURCE.md).

---

## 7. Deduplicatie

Twee soorten:

1. **Binnen één bron** is triviaal: `source + sourceListingId` is de identiteit,
   afgedwongen door een unique-index. Geen code nodig.
2. **Over bronnen heen** is het echte werk. Dezelfde woning staat op twee sites,
   met een andere titel en soms €5.000 prijsverschil.

**Kandidaten zoeken met drie strategieën, niet één.** De vingerafdruk is een
*blocking key* met harde grenzen: 94 m² en 96 m² vallen in verschillende
buckets. Was dat de enige ingang, dan miste die match. Daarom:

| strategie | sterkte | zwakte |
|---|---|---|
| telefoonnummer | het scherpst | vaak niet beschikbaar |
| vingerafdruk | snel | mist randgevallen |
| postcode + prijsvenster (±10%) | breed | traag |

De resultaten worden samengevoegd; `scoreDuplicate()` velt het oordeel.

**Beoordelen met een gewogen som**, niet met noisy-or. Bij classificatie bewijst
elk signaal *op zichzelf* iets; hier niet. Dezelfde postcode bewijst niets
(9000 Gent heeft duizenden woningen), maar dezelfde postcode plus dezelfde
oppervlakte plus dezelfde prijs bewijst veel. De signalen zijn afhankelijk, dus
wegen we ze en delen door het gewicht dat we werkelijk kónden beoordelen —
ontbrekende velden verlagen de score niet, ze doen niet mee.

Twee uitzonderingen buiten de som:

- **Identiek telefoonnummer** haalt de helft van de resterende twijfel weg, met
  een bodem van 0,75 — maar alleen als de woningkenmerken zelf al boven 0,5
  zaten. Een verkoper kan twee panden hebben.
- **Verschillende postcode** kapt de score af op 0,2, hoe goed de rest ook
  matcht. Dat is bewijs *tegen*.

Een **herplaatsing** (zelfde bron, nieuw id, praktisch dezelfde inhoud) is iets
anders dan een duplicaat: geen weggooien, wel −12 op de score, want hij is minder
vers dan hij lijkt.

---

## 8. Alerts

Vier poorten tussen "particuliere advertentie" en "bericht verstuurd":

1. Is de lead goed genoeg? — classificatie ≥ drempel, score ≥ drempel
2. Wil dit abonnement hem? — gebied, prijs, type, telefoon-eis
3. Is hij al verstuurd? — unieke `dedupeKey`
4. Kan hij verstuurd worden? — actief abonnement, bekende chat

**Poort 3 staat in de database, niet in code.** `dedupeKey` is
`abonnement:advertentie:reden` en heeft een UNIQUE-constraint. De rij wordt
aangemaakt *vóór* de netwerkoproep, niet erna: andersom zou een crash tussen
versturen en opslaan een tweede bericht opleveren.

De derde component (`reden`) bestaat zodat een prijsdaling wél een tweede
bericht mag opleveren — dat is nieuws dat de makelaar wil hebben.

Elke ontvanger wordt afzonderlijk afgehandeld: een makelaar die zijn bot
blokkeerde mag de melding aan de anderen niet tegenhouden. Mislukte berichten
worden door de worker opnieuw geprobeerd, maximaal drie keer.

**Dry-run.** Zonder `TELEGRAM_BOT_TOKEN` verstuurt de client niets en wordt de
alert vastgelegd met `SUPPRESSED_DRY_RUN`. Die telling staat apart in het
dashboard en in `CollectorRun.alertsSuppressed` — anders lijkt de standaard­opstelling,
waarin iedereen begint, op een storing.

---

## 9. Gebieden

Vier soorten, in aflopende sterkte: `POSTAL_CODE` (exact), `MUNICIPALITY`,
`RADIUS`, `PROVINCE`. Die volgorde bepaalt de `precision`, en die bepaalt de
punten in de leadscore: een makelaar die op postcode werkt hoort een hogere
score te zien dan een collega die de hele provincie aanvinkte.

Postcodes → provincie via een **bereik-tabel van twaalf regels**, niet een lijst
van 2.700 postcodes. België deelt postcodes uit in aaneengesloten blokken per
provincie; die blokken zijn stabiel, terwijl een gemeentelijst bij elke fusie
veroudert. (Let op 1300–1499: dat is Waals-Brabant, niet Vlaams-Brabant.)

Gemeentenamen worden genormaliseerd vergeleken — accenten, hoofdletters en
koppeltekens weg. Deelgemeenten matchen op woordgrens, zodat een gebied
"Antwerpen" wel "Antwerpen Berchem" dekt maar "Gent" niet "Gentbrugge".

---

## 10. Wat er bewust niet is

Betalingen, mobiele apps, AI-chat, CRM, WhatsApp, e-mailnotificaties,
gebruikersbeheer met rollen, meertaligheid in het dashboard.

Ook geen AI-classifier. De regelmotor is goedkoper en uitlegbaar; de plek waar
een model zou aanhaken is `classifySeller()`, dat een `SellerClassification`
teruggeeft en verder niets van zijn aanroeper weet.
