# Halal Home

Een begeleidingsplatform voor moslims die een woning kopen. Geen zoekmachine met
extra's, maar een **traject**: van oriëntatie tot de sleutel, met op elk moment
antwoord op vier vragen.

```
Waar sta ik?   Wat moet ik nu doen?   Wat ontbreekt er?   Wat komt eraan?
```

---

## Snel starten

```bash
# 1. Afhankelijkheden
npm install

# 2. Configuratie
cp .env.example .env
# Vul AUTH_SECRET en STORAGE_SIGNING_SECRET in:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Database (Postgres op poort 5433)
docker compose up -d db

# 4. Schema en testdata
npm run db:migrate
npm run db:seed

# 5. Draaien
npm run dev
```

Inloggen met de gegevens die de seed onderaan afdrukt (standaard
`dev@halalhome.local` / `halalhome123`).

> **Windows-opmerking.** Blokkeert je machine de native SWC-binary van Next
> (melding "geblokkeerd door een beleid voor toepassingsbeheer"), gebruik dan
> `npm run build:webpack` in plaats van `npm run build`. In Docker en CI speelt
> dit niet.

### Alles controleren

```bash
npm run verify   # prisma validate + generate, typecheck, lint, tests
```

---

## De drie beloftes die de architectuur sturen

### 1. Het platform velt geen religieus oordeel

Halal Home is geen mufti. Het zegt nooit "dit product is halal". Wat het wél
doet is nauwkeurig weergeven **wie wat beweert, op grond waarvan, en wanneer dat
is nagekeken**:

| Status             | Betekent                                                    |
| ------------------ | ----------------------------------------------------------- |
| `CERTIFIED`        | Een genoemd shariah-orgaan certificeert het product          |
| `PROVIDER_CLAIMED` | Alleen de aanbieder zelf beweert het                         |
| `REVIEWED`         | Wij lazen de publieke documentatie. Geen fatwa               |
| `UNVERIFIED`       | Bron bekend, niet nagelezen                                  |
| `UNKNOWN`          | Geen informatie. De standaard, want dat is het veilige antwoord |

`validateAssessment()` weigert combinaties die niet kloppen: `CERTIFIED` zonder
certificerend orgaan mag niet gepubliceerd worden, want de gebruiker ziet dan een
sterk signaal dat hij niet kan controleren. Elke weergave sluit af met het
voorbehoud dat dit geen religieus advies is — dat zit in de domeinlaag, zodat er
geen pagina kán bestaan die de status toont zonder het voorbehoud.

Zie [`src/modules/financing/domain/shariah.ts`](src/modules/financing/domain/shariah.ts).

### 2. Berekeningen zijn deterministisch, AI legt alleen uit

De financieringscalculator bevat geen AI, geen netwerk en geen `Date.now()`.
Dezelfde invoer geeft altijd exact hetzelfde getal, want hierop baseert iemand
een aankoop van honderdduizenden euro's. Elke berekening geeft haar **aannames**
mee terug, en die worden opgeslagen bij de quote — zodat een gebruiker over drie
maanden nog ziet waarop hij zich baseerde.

AI mag constructies uitleggen. AI berekent nooit.

Zie [`src/modules/financing/domain/calculators/`](src/modules/financing/domain/calculators/) — één calculator per constructie.

### 3. Fiscale en juridische regels staan in data, niet in code

De Vlaamse registratierechten zijn in vijf jaar drie keer gewijzigd. Elke
wijziging die een release vereist, is een wijziging die te laat komt en waarbij
een koper intussen duizenden euro's te weinig opzij zet.

Tarieven staan daarom in `CostRule` met een geldigheidsvenster, een bron-URL en
een verificatiedatum. Een wetswijziging is een INSERT; de oude rij krijgt een
`validUntil` in plaats van overschreven te worden, zodat een raming van vorig
jaar navolgbaar blijft. Hetzelfde geldt voor checklists (`ChecklistTemplate`) —
die staan nergens in een React-component.

Zie [`src/modules/financing/domain/costRules.ts`](src/modules/financing/domain/costRules.ts).

---

## User isolation

Dit platform bewaart identiteitskaarten, loonfiches en bankafschriften. Het
ergste dat het kan doen is die aan de verkeerde gebruiker tonen.

Er is precies één manier om te weten wie de huidige gebruiker is:

```ts
const userId = await requireUserId()   // uit de sessie
```

Nooit uit een request:

```ts
const userId = request.nextUrl.searchParams.get('userId')   // nee
const { userId } = await request.json()                     // nee
```

Elke repository-functie neemt die `userId` als eerste argument en zet hem in de
WHERE-clausule — ook waar een `journeyId` de gebruiker al impliciet bepaalt.
Daarom gebruiken schrijfacties `updateMany` in plaats van `update`: `update`
matcht alleen op unieke velden, en dan past `userId` niet in de WHERE.

[`tests/auth/isolation.test.ts`](tests/auth/isolation.test.ts) vervangt de
Prisma-client door een spion en controleert dat élke query filtert. Dat vangt de
fout die anders pas in productie opvalt: `findUnique({ where: { id } })` werkt
perfect, geeft nette data terug, en lekt het traject van iemand anders.

---

## Documentbeveiliging

| Maatregel                     | Waar                                                |
| ----------------------------- | --------------------------------------------------- |
| Witte lijst van bestandstypen | `ALLOWED_MIME_TYPES` — geen SVG (XSS), geen archieven |
| Inhoudscontrole               | `hasValidMagicBytes` — de `Content-Type` van een upload is een bewering, geen feit |
| Onraadbare sleutels           | `documents/<userId>/<categorie>/<uuid>` — nooit de bestandsnaam van de gebruiker |
| Privéopslag                   | Geen publieke URL; downloads via een aflopend, gesigneerd token |
| Padcontrole                   | `resolveSafePath` weigert `../` — anders is een download een willekeurige-bestandslezer |
| Constante-tijd-vergelijking   | `timingSafeEqual` op handtekeningen                 |
| Soft delete                   | Het bestand gaat écht weg, de auditregel blijft      |

Het gesigneerde token is **geen vervanging** voor autorisatie: de download-route
controleert altijd of het document van de ingelogde gebruiker is.

---

## Structuur

```
src/
├── app/
│   ├── (public)/       homepage, login, register
│   ├── (dashboard)/    alles achter een login — de authcheck staat in de layout,
│   │                   dus een nieuwe pagina is automatisch beschermd
│   └── api/
├── modules/            domeinen; per domein domain/ (puur) + repository/ + service/
│   ├── auth/           sessie, wachtwoorden, user isolation
│   ├── journey/        fasen, taken, afhankelijkheden, voortgang, aanbevelingen
│   ├── property/       matching
│   ├── search/         criteria-schema (Zod als bron van waarheid)
│   ├── financing/      calculators per constructie, kostenregels, shariah-herkomst,
│   │                   quotes, journey-bridge
│   ├── neighborhood/   afstand, persoonlijke buurtscore
│   ├── audit/          audit logging
│   └── billing/        plannen en feature flags
├── components/
├── config/             env (server-only) en public
├── server/             db, storage, integrations, api-handler
└── types/              provider-contracten (ai, storage, places, propertySource)
```

De regel: **React-componenten bevatten geen Prisma-queries.** Queries horen in
`modules/<domein>/repository.ts`, zodat user isolation per domein op één plek
afdwingbaar is.

`domain/` bevat pure functies zonder database en zonder netwerk. Daarom draait de
hele testsuite zonder Postgres.

---

## Provider-abstracties

Vier externe afhankelijkheden zitten achter een interface, zodat een wissel geen
enkele aanroeper raakt:

| Contract                | Implementaties                        |
| ----------------------- | ------------------------------------- |
| `AiProvider`            | Anthropic, OpenAI, uitgeschakeld      |
| `StorageProvider`       | lokaal (dev); S3/R2/Supabase later    |
| `PlacesProvider`        | fixture, Overpass                     |
| `PropertySource`        | fixture; officiële API's en feeds later |

**De modelnaam staat nergens in de code.** Hij komt uit `AI_MODEL`. Een hardcoded
modelnaam werkt tot het model uitgefaseerd wordt en breekt dan in productie, ver
van de plek waar hij staat.

Met `AI_ENABLED=false` geeft de provider een nette `AiDisabledError` in plaats van
`null`. Zo hoeft geen enkele aanroeper te controleren of AI aanstaat.

### Over vastgoedbronnen

Een bron mag officiële API's, feeds, sitemaps en aangeleverd makelaarsaanbod
gebruiken, identificeert zich met een eerlijke user-agent, respecteert robots.txt
en houdt zich aan de rate limit.

Geen CAPTCHA-omzeiling, geen stealth-scraping, geen fingerprint-spoofing, geen
proxy-rotatie. Dat is geen slag om de arm maar een ontwerpkeuze: een platform dat
mensen door een aankoop van honderdduizenden euro's begeleidt, kan niet draaien
op een databron die morgen wegvalt.

---

## De flow

```
Onboarding (5 stappen, hervatbaar)
   ↓
Journey automatisch aangemaakt — idempotent
   ↓
Dashboard toont fase, voortgang en volgende stap
   ↓
Stage openen → taak voltooien
   ↓
Afhankelijke taak wordt vrijgegeven
   ↓
Checklist afvinken → voortgang verandert
   ↓
Laatste verplichte taak → volgende fase wordt actief
   ↓
Nieuwe aanbeveling verschijnt
```

### Hoe voortgang berekend wordt

Een gebruiker moet kunnen begrijpen waarom hij op 37 % staat, dus staat de
formule vast en geeft `explainProgress()` hem in woorden terug — dat is wat de
UI onder "Hoe wordt dit berekend?" toont.

| | |
| --- | --- |
| Gewicht verplichte taak | 1,0 |
| Gewicht optionele taak | 0,4 |
| Afgehandeld | `COMPLETED` óf `SKIPPED` |
| Per fase | som(gewicht afgehandeld) ÷ som(gewicht totaal) |
| Hele traject | zelfde som over alle fasen, met de huidige fase als ondergrens |

Fasen wegen **niet** allemaal 10 %: oriëntatie heeft drie taken, financiering
zeven. Het gewicht van een fase is het aantal taken erin. De fase-ondergrens
zorgt dat de balk nooit zakt wanneer je vooruit gaat en daarmee nieuwe open
taken binnenhaalt — dat zou als straf voor vooruitgang voelen.

`SKIPPED` telt mee omdat 100 % anders onbereikbaar is voor wie een optionele
taak terecht overslaat, en een onbereikbare balk stopt met betekenen.

### Stabiele taak-identifiers

Blauwdruktaken hebben sleutels als `FINANCING_COMPARE_OPTIONS` —
UPPER_SNAKE_CASE, beginnend met hun fase. Migraties, analytics, aanbevelingen en
blauwdruk-upgrades verwijzen hiernaar; een database-id kan dat niet, want die
verschilt per gebruiker.

`HomeBuyingJourney.blueprintVersion` legt vast met welke versie een traject is
opgezet. Wie vandaag begint, ziet over drie maanden geen taken verdwijnen omdat
wij de lijst herzien hebben. `getBlueprint()` gooit bij een onbekende versie in
plaats van stil terug te vallen.

### Idempotentie

Twee keer op "afronden" klikken geeft geen 88 taken. Drie sloten:

1. unique constraint op `(userId, name)`;
2. `initializedAt` — is die gezet, dan slaan we het opzetten over;
3. unique constraint op `(journeyId, templateKey)` — vangt zelfs de race waarin
   twee requests tegelijk door de eerste twee komen.

---

## Testen

```bash
npm test                   # 534 tests, geen database, geen netwerk
npm run test:integration   # vereist TEST_DATABASE_URL
```

Externe diensten worden altijd gemockt — een test die een echte API aanroept is
geen test maar een beschikbaarheidsmeting.

**Unit** (534): fase-overgangen · voortgang en de uitleg ervan · stage-states ·
blauwdruk-samenhang en versiebeheer · taakafhankelijkheden en cyclusdetectie ·
aanbevelingsregels · onboardingstappen en hervatten · checklist-selectie en
-voortgang · analytics-whitelist · geldeenheden · financieringsberekeningen ·
shariah-herkomst · kostenregels · property matching · zoekcriteria · buurtscore ·
uploadbeleid · user isolation · environment-validatie · zoekparser (NL → criteria) · normalisatie en ontdubbeling · fixture-bron · woningvergelijking · financieringscalculators per constructie · financieringsbehoefte · actualiteit van bronnen · demo-markering · financieringsvergelijking · welke taken automatisch afvinkbaar zijn.

**Integratie** (40, tegen echte Postgres): journey-initialisatie · idempotentie
bij dubbele submit · afhankelijkheden vrijgeven · verplichte taak niet
overslaanbaar · fase-overgang bij de laatste verplichte taak · onboarding
hervatten · cross-user reads en writes geblokkeerd · quote-snapshots die niet meeveranderen met het product · propertyId-relatie · automatische taakafvinking bij objectief bewijs.

```bash
docker compose up -d db
TEST_DATABASE_URL=postgresql://halalhome:halalhome@localhost:5433/halalhome_test npm run test:integration
```

Zonder `TEST_DATABASE_URL` melden ze zich als **skipped**, niet als geslaagd:
een test die niet gedraaid heeft mag nooit groen lijken.

---

## Demodata — lees dit

De seed bevat **verzonnen** financieringsaanbieders (namen met "Voorbeeld",
websites op `example.com`) en **niet-geverifieerde** kostenregels (`notes` bevat
`ONTWIKKELWAARDE`, `lastVerifiedAt` is `null`).

Dat is opzet. Een seed-bestand is geen bron. Een rij met "Bank X — CERTIFIED door
orgaan Y" die uit het hoofd van een ontwikkelaar komt, ziet er in de interface
exact hetzelfde uit als een rij die iemand heeft nagekeken bij de aanbieder. De
gebruiker kan het verschil niet zien — en juist dát is wat dit platform belooft
te voorkomen.

**Voor productie:** laat een redacteur de tarieven nakijken bij de belastingdienst
van het gewest en de producten bij de aanbieders, vul `sourceUrl` en
`lastVerifiedAt` in, en kies een `shariahAssessmentStatus` die bij de onderbouwing
past.

---

## Zoeken

```
vrije tekst → criteria → bronnen → normaliseren → ontdubbelen → matchen → matches
```

**De parser heeft twee lagen, en de onderste werkt altijd.** Een deterministische
parser (regex en woordenlijsten, geen netwerk) doet het basiswerk; de AI-laag
krijgt hetzelfde Zod-schema als contract en verfijnt. Bij `AI_ENABLED=false`, een
time-out of ongeldige output valt hij terug op de eerste laag — een zoekmachine
die stilvalt omdat een externe dienst hapert, kan je niet vertrouwen.

Bij het samenvoegen **wint de deterministische parser** op wat letterlijk in de
tekst staat: een postcode of een bedrag mag een taalmodel niet overschrijven.

**Hard versus voorkeur** is het belangrijkste onderscheid. "minstens 3
slaapkamers" is een eis; "liefst EPC A of B" een wens. Het eerste filtert weg,
het tweede verlaagt alleen de score.

### Ontdubbelen, drie niveaus

| Niveau | Signaal | Zeker? |
| --- | --- | --- |
| `exact` | `(source, externalId)` | ja — de bron zegt het zelf |
| `url` | genormaliseerde URL | ja — twee ingangen, één pagina |
| `fingerprint` | adres + prijs + oppervlakte + type | **nee** |

Een gelijke vingerafdruk wordt bewust níet samengevoegd: twee identieke
nieuwbouwappartementen in hetzelfde gebouw geven dezelfde hash. Daarom heeft
`fingerprint` geen unique constraint — het is een aanwijzing, geen bewijs.

### Vergelijken

Tot vier woningen naast elkaar. Per rij wordt de gunstigste waarde gemarkeerd,
met een vinkje naast de opmaak zodat het niet alleen kleur is. **Er wordt geen
winnaar aangewezen** — een totaalscore verbergt precies de afweging die de koper
zelf moet maken. Rijen waarvoor geen enkele woning een waarde heeft, vallen weg.

---

## Financiering

### Eén calculator per constructie

Murabaha, ijara en afnemend partnerschap leiden alle drie tot een vast
maandbedrag, maar dat bedrag *betekent* iets anders. Alles door één functie
duwen die overal "rente" van maakt, is precies de gelijkschakeling die dit
platform vermijdt.

| Constructie | Wat het maandbedrag heet | Wat de opbouw toont |
| --- | --- | --- |
| Murabaha | Maandelijkse termijn | Opslag, totale verkoopprijs |
| Ijara | Maandelijkse **huur** | Huur boven de ingebrachte waarde |
| Afnemend partnerschap | Gebruiksvergoeding **+** overname | Aandeel, dalende vergoeding, stijgende overname |
| Qard hasan | Maandelijkse aflossing | Geen vergoeding op het geleende bedrag |
| Klassiek krediet | Maandelijkse aflossing | Hoofdsom en **rente** — want hier ís het rente |

Een constructie toevoegen is een klasse schrijven die `FinancingCalculator`
implementeert en hem in het register zetten. Geen `switch` die meegroeit.

**Correctheid gaat voor dekking.** Publiceert een aanbieder geen tarief, dan
komt er `Berekening niet beschikbaar` mét reden — geen generieke formule zodat
er toch een bedrag staat. Een verkeerd bedrag is erger dan geen bedrag: op een
leeg veld belt iemand de aanbieder, op een fout getal rekent hij zich rijk.

### Een quote is een snapshot, geen verwijzing

Alles wat nodig is om een berekening te begrijpen staat *in* de rij: de naam van
de aanbieder, het gehanteerde tarief, de shariah-status met haar bron en
verificatiedatum, en `calculatorVersion` (`financing-engine@1`).

Die redundantie is opzet. Verhoogt de aanbieder morgen zijn marge, trekt hij het
product in, of herzien wij de formule — een quote van 7 augustus toont over een
jaar nog exact hetzelfde. Alleen `status` en `notes` zijn wijzigbaar; wie een
andere berekening wil, maakt een nieuwe.

### Geen beste optie

De vergelijking markeert per rij de gunstigste waarde, maar wijst **geen winnaar
aan**. Niet uit voorzichtigheid: er bestaat geen eerlijk criterium. De goedkoopste
optie kan een zwakkere onderbouwing hebben, en hoe zwaar dat weegt is
persoonlijk.

De shariah-status staat daarom **buiten** de vergelijkbare rijen, in een eigen
blok zonder markering. Een certificering rangschikken als was het een rentevoet,
is dezelfde fout in een ander jasje.

Ontbrekende waarden tonen `Niet beschikbaar`, nooit `0`. Nul is een bewering;
ontbrekend is de waarheid.

### Wat het systeem zelf mag afvinken

Alleen taken waarvan het bewijs objectief in de database staat:

| Taak | Voorwaarde |
| --- | --- |
| `FINANCING_COMPARE_OPTIONS` | Berekeningen bewaard voor ≥ 2 *verschillende* producten |

`NEVER_SYSTEM_COMPLETABLE` is de expliciete tegenlijst — "Begrijp je
financiering" gebeurt in iemands hoofd en kan een systeem niet weten. Een test
bewaakt dat de twee lijsten elkaar niet overlappen. Taken die de gebruiker zelf
op `SKIPPED` zette blijven met rust.

### Demodata kan niet als echt doorgaan

`isDemo` staat op provider én product, apart van `verified`: "niet nagekeken" en
"bestaat niet" zijn twee verschillende dingen.
`assertDemoNeverVerified()` gooit op de combinatie demo + verified, en draait in
de UI, in de service én in de API-route. Voorbeeldproducten staan in een eigen
sectie met eigen kop — alleen een badge werkt niet, want bij snel scannen vallen
badges weg.

---

## Geldeenheden

Twee eenheden, en de veldnaam zegt altijd welke:

| Achtervoegsel | Eenheid | Waar |
| --- | --- | --- |
| `...Cents` | eurocent | Alles wat de gebruiker invoert of wat wij uitrekenen: budget, eigen middelen, maandlast |
| *(geen)* | hele euro's | Vastgoedprijzen (advertenties kennen geen centen) en fiscale grondslagen |

Omzetten gaat uitsluitend via [`src/lib/money.ts`](src/lib/money.ts).
`eurosFromCents()` weigert een bedrag dat geen heel aantal euro's is in plaats
van stil af te ronden; wie wél wil afronden roept `roundToWholeEuros()` aan en
maakt die keuze daarmee zichtbaar. Twee eenheden door elkaar halen is een fout
van precies factor honderd, en een budget van 4.500 € dat als 450.000 € gelezen
wordt is geen afrondingsverschil maar een verkeerd huis.

---

## Wat er nog niet is

Nog te bouwen: de documentkluis met upload en de notarismodule (fase 5), de
buurtmodule met een echte places provider (fase 6), de AI-assistent (fase 7) en
notificaties (fase 8).
De contracten en datamodellen staan er; het zijn implementaties, geen
herschrijvingen.
