# Integration Validation Report

**Datum:** 9 augustus 2026
**Aanleiding:** 68 geschreven maar overgeslagen database-integratietests moesten
daadwerkelijk uitgevoerd worden tegen echte PostgreSQL, vóór Fase 6.

**Uitkomst:** 671 unit tests en 131 integratietests groen tegen echte
PostgreSQL 17. Nul overgeslagen. Twee echte bugs gevonden en opgelost, waarvan
één alleen door een databasetest zichtbaar kon worden.

---

## 1. Hoe PostgreSQL is opgezet

Er is geen Docker, `psql` of `pg_ctl` op deze machine. In plaats van dat als
blokkade te behandelen draait de suite op **`embedded-postgres@17.10.0-beta.17`**:
echte PostgreSQL 17-binaries, gestart als los proces over TCP.

Overwogen en verworpen: een in-memory emulatie (pg-mem of vergelijkbaar). De
hele reden dat deze suite bestaat is bewijzen dat de *database* doet wat we
denken — unique indexes, foreign keys, cascades, transactie-isolatie. Een
emulatie zou precies die dingen benaderen die getest moeten worden.

| | |
|---|---|
| Poort | `54329` — niet 5432 (lokale Postgres) en niet 5433 (docker-compose) |
| Gebruiker | `halalhome_test` |
| Database | `halalhome_integration` |
| Persistentie | `persistent: false` — de datadirectory verdwijnt na afloop |
| Serverlogs | onderdrukt via `onLog: () => {}`, want querylogs bevatten data |

**Bestanden:** `tests/integration/database.ts` (harness + guards),
`tests/integration/globalSetup.ts` (één keer starten, migreren),
`tests/integration/setup.ts` (per testbestand).

Eén installatiehobbel: npm blokkeerde het postinstall-script van
`@embedded-postgres/windows-x64`. Opgelost met
`npm approve-scripts @embedded-postgres/windows-x64`; de goedkeuring staat nu in
`package.json`.

## 2. Docker- en configwijzigingen

`docker-compose.yml` is **niet** gewijzigd. De testomgeving draait er volledig
naast; wie wél Docker gebruikt, houdt zijn ontwikkeldatabase op 5433.

Wel gewijzigd:

- `vitest.integration.config.ts` — `globalSetup` toegevoegd, `hookTimeout`
  op 180 s (de eerste run pakt PostgreSQL-binaries uit), `fileParallelism: false`;
- `package.json` — script `db:verify-seed`, dependency `embedded-postgres`,
  goedgekeurd postinstall-script;
- `.env.example` — `TEST_DATABASE_URL` gedocumenteerd, uitgecommentarieerd, met
  de waarschuwing waarom hij nooit gelijk aan `DATABASE_URL` mag zijn.

## 3. Guards op de testdatabase

In `assertSafeTestDatabase()`, en hij draait **twee keer**: in `globalSetup`
vóór de migraties, en opnieuw per testbestand in `setup.ts`.

Geweigerd wordt:

1. een ontbrekende `TEST_DATABASE_URL`;
2. gelijkheid met `DATABASE_URL` (genormaliseerd vergeleken, dus
   trailing slash en whitespace tellen niet mee);
3. een databasenaam met `production`, `prod`, `live`, `staging`, `acceptance`
   of `main`;
4. een host die niet `localhost`, `127.0.0.1`, `::1` of `0.0.0.0` is.

Punt 3 matcht op woordgrenzen. Zonder dat zou `halalhome_integration`
struikelen over de `main` in "do**main**" — een guard die op zijn eigen valse
positief vastloopt, wordt vroeg of laat uitgezet, en dan beschermt hij niets meer.

De guard is de tweede verdediging, niet de eerste. Zonder `TEST_DATABASE_URL`
start de suite zijn eigen wegwerpdatabase; er is dus geen reden om er ooit een
echte URL in te zetten.

## 4. Migraties vanaf een lege database

`npx prisma migrate deploy` tegen een **volledig lege** database, met
`DATABASE_URL` overschreven naar de test-URL.

Bewust géén `prisma db push`: die synchroniseert het schema rechtstreeks en
verbergt daarmee precies wat we willen weten — of de migraties kloppen.

Twee migraties, beide toegepast:

- `20260807000000_init`
- `20260809000000_document_idempotency_key` (nieuw, zie punt 16)

**Driftcontrole:** na `migrate deploy` op een verse database geeft
`prisma migrate diff --from-url <testdb> --to-schema-datamodel prisma/schema.prisma`
de uitvoer `-- This is an empty migration.` Migraties en schema zijn dus
identiek; er is geen handmatig verschil ingeslopen.

`prisma validate` en `prisma generate` slagen.

## 5. Seed

Uitgevoerd via `npm run db:verify-seed` (`scripts/verify-seed.ts`): start een
verse database, migreert, en draait `prisma/seed.ts` **twee keer** als apart
proces — precies zoals een ontwikkelaar het zou doen.

**De seed is idempotent.** Alle 17 gemeten tellingen zijn na de tweede run
identiek, geen constraint failures:

```
users 1  journeys 1  tasks 43  dependencies 23  blockingDependencies 5
checklistTemplates 3  checklistItems 34  userChecklistItems 6  terms 14
costRules 6  financingProviders 3  financingProducts 4  properties 3
serviceProviders 3  searches 1  savedProperties 1  documents 1  events 2
```

**Hierbij is bug 2 gevonden — zie punt 15.** De seed paste alleen
`task.dependsOn` toe en sloeg `blockedBy` over. Een geseed traject had daardoor
*nul* blokkerende afhankelijkheden: de ontwikkelomgeving zou een bod zonder
financieringsbewijs gewoon hebben doorgelaten. Na de fix: 18 → 23
afhankelijkheden, waarvan 5 BLOCKING. Het verificatiescript faalt nu expliciet
als `blockingDependencies === 0`, zodat dit niet opnieuw ongemerkt kan wegvallen.

## 6. Totaal uitgevoerde integratietests

**131 uitgevoerd, 131 geslaagd, 0 overgeslagen.** 9 testbestanden.

| Bestand | Tests |
|---|---:|
| `documents.test.ts` | 28 |
| `journey.test.ts` | 17 |
| `financing.test.ts` | 15 |
| `documentsLifecycle.test.ts` | 14 |
| `documentsSignedUrl.test.ts` | 14 |
| `storageFilesystem.test.ts` | 14 |
| `schemaConstraints.test.ts` | 11 |
| `onboarding.test.ts` | 10 |
| `documentsIdempotency.test.ts` | 8 |

De oorspronkelijke 68 zijn opgegaan in de eerste vier regels van
`documents`/`journey`/`financing`/`onboarding` en zijn nu allemaal *executed*.

## 7. Financing (15 tests)

Tegen echte PostgreSQL bewezen:

- **Persistentie** — de quote wordt bewaard met alle snapshotvelden en de
  aannames die tot het bedrag leidden;
- **Snapshotonveranderlijkheid** — een bewaarde quote verandert niet wanneer het
  onderliggende product wijzigt, en blijft leesbaar wanneer het product
  verwijderd wordt. Dat is de kern: een berekening die de gebruiker gezien heeft
  mag niet achteraf een ander getal tonen;
- **Relaties** — de koppeling met een woning wordt vastgelegd, en de quote
  overleeft het verdwijnen van die woning;
- **Weigering** — een quote waarvan de berekening niet beschikbaar is, wordt niet
  bewaard (liever geen getal dan een verkeerd getal);
- **Cross-user isolatie** — Bob kan de quote van Alice niet lezen, wijzigen,
  verwijderen of in zijn lijst zien, en Alice kan geen quote aan Bobs traject
  hangen;
- **Journey-integratie** — één product telt nog niet als vergelijking, twee
  verschillende producten vinken de taak af, en overgeslagen taken blijven
  overgeslagen.

## 8. Documenten (28 + 14 + 8 = 50 tests)

`documents.test.ts` (28): upload schrijft echt weg en zet de rij op AVAILABLE;
checksum vastgelegd; onraadbare storage key zonder bestandsnaam; dubbele upload
gemeld maar niet geblokkeerd; magic-byte-, leeg- en typecontrole; download geeft
inhoud en logt zonder inhoud; verwijderen wist het bestand écht en zet
`deletedAt` én `purgedAt`; dubbel verwijderen geweigerd; verwijderde documenten
verborgen in de lijst; checklistkoppeling losgemaakt; uitleg met bronchecksum,
nooit overschreven, verouderd gemarkeerd na wijziging.

`documentsLifecycle.test.ts` (14) en `documentsIdempotency.test.ts` (8): zie
punten 11–13.

## 9. IDOR en security

**Document-IDOR is nu database-bewezen, niet mock-bewezen.**
`documentsSignedUrl.test.ts` draait door de échte route handler
(`src/app/api/documents/download/route.ts`) heen, met een echte rij in
PostgreSQL en een echt bestand op schijf. Alleen `requireUserId()` is vervangen
— die kán niet echt zijn buiten een browser, en het is precies de knop die we
van Alice naar Bob willen kunnen omzetten.

Volledige matrix, elk geval afzonderlijk getest:

| handtekening | sessie | staat | resultaat |
|---|---|---|---|
| geldig | eigenaar | AVAILABLE | 200 + inhoud |
| geldig | **andere gebruiker** | AVAILABLE | **404, geen inhoud** |
| geldig | niet ingelogd | AVAILABLE | fout, geen inhoud |
| verlopen (correct gesigneerd) | eigenaar | AVAILABLE | ≥400, geen inhoud |
| vervalst | eigenaar | AVAILABLE | ≥400, geen inhoud |
| geldig, `expires` opgerekt | eigenaar | AVAILABLE | ≥400, geen inhoud |
| geldig, key naar andermans map | eigenaar | AVAILABLE | ≥400, geen inhoud |
| geldig, key met `../../.env` | eigenaar | — | geen `.env`-inhoud |
| ontbrekende handtekening | eigenaar | AVAILABLE | ≥400, geen inhoud |
| geldig | eigenaar | **DELETED** | ≥400, geen inhoud |
| geldig | eigenaar | **PENDING** | ≥400, geen inhoud |

Elke assertie controleert óók dat de geheime bytes niet in de response staan —
niet alleen dat de statuscode goed is. Plus: audittrail zonder inhoud,
`no-store` / `nosniff` / `noindex`-headers, en TTL ≤ 1 uur.

De DELETED-zaak test eerst dat dezelfde URL wél werkte vóór het verwijderen.
Zonder die voorcontrole bewijst "geeft niets terug" niets.

Daarnaast in `documents.test.ts` en `journey.test.ts`: Bob kan Alice haar
document niet lezen, downloaden, verwijderen, van metadata voorzien of uitleggen;
ziet het niet in zijn lijst; Alice kan haar document niet aan Bobs traject of
aan een niet-bewaarde woning koppelen; Bob kan Alice haar traject, taken en
checklist niet aanraken. Overal 404 in plaats van 403 — het bestaan zelf is al
informatie.

## 10. Transacties

`schemaConstraints.test.ts`:

- een transactie die halverwege een gewone fout gooit, laat **niets** achter;
- een transactie die halverwege op een unique constraint klapt, draait ook de
  eerste, op zichzelf geldige, schrijfactie terug;
- bij succes staat álles er: traject plus taken plus afhankelijkheden.

Dat laatste is de keerzijde die vaak vergeten wordt. Een traject met de helft
van zijn taken levert een gebruiker op die vastloopt zonder uitleg.

Referentiële integriteit, apart getoetst:

- FK-schending geeft P2003 (document voor een niet-bestaande gebruiker);
- **Cascade** — een gebruiker verwijderen wist zijn documenten, traject, taken
  en afhankelijkheden. Dat is de belofte achter "account verwijderen";
- **SetNull** — een document blijft bestaan wanneer de gekoppelde woning of het
  traject verdwijnt. Een verkoopovereenkomst hoort niet te verdampen omdat een
  zoekresultaat opgeruimd wordt;
- uniques: storage key, e-mailadres, `(taskId, dependsOnId)`,
  `(journeyId, itemId)`, `(journeyId, templateKey)`.

## 11. Concurrency

- **Idempotency-race** — drie gelijktijdige uploads met dezelfde sleutel geven
  één document-id, één rij, en precies één niet-replayed resultaat. Dit is het
  geval dat de bestaanscontrole in de applicatiecode níet kan afvangen: alle
  drie zien "nog niets". Wat hen tegenhoudt is de unique index;
- **Gelijktijdig opruimen** — drie overlappende `purgeOrphans()`-runs over drie
  weeskandidaten: nul failures, alle bestanden weg, alle rijen `purgedAt` gezet.
  `rm --force` op iets dat een andere run net wiste is geen storing, en de
  provider gooit er terecht niet op.

## 12. Purge

`purgeOrphans()`, alle drie de gevraagde runs:

- **eerste run** — ruimt op, `purged > 0`, `failures === 0`, bestand weg,
  `purgedAt` gezet;
- **tweede run** — `purged === 0`, `failures === 0`. Idempotent: dezelfde rij
  wordt niet nog eens meegeteld;
- **gelijktijdig** — zie punt 11;
- **blijvende storing** — als het wissen faalt, blijft `purgedAt` leeg en telt
  de run een failure. Niet stilzwijgend op purged zetten: dan zou een bestand
  dat nooit verdween wél als verdwenen geboekt staan. De volgende ronde pakt hem
  alsnog op — ook dat is getest.

## 13. Upload-idempotentie

**Geïmplementeerd op `(userId, idempotencyKey)`, niet op SHA-256.**

Waarom dat verschil ertoe doet: een checksum beantwoordt "zijn dit dezelfde
bytes?", en dat is een andere vraag dan "is dit dezelfde handeling?". Beide
richtingen lopen mis:

- twee handelingen, dezelfde bytes — dezelfde loonfiche voor twee aanvragen.
  Op checksum dedupliceren laat hier een document verdwijnen dat de gebruiker
  bewust aanmaakte;
- één handeling, twee verzoeken — dubbelklik of een browser die na een time-out
  opnieuw verstuurt. Precies één document.

De client (`DocumentUpload.tsx`) genereert een sleutel per bestandskeuze,
stuurt hem mee bij elke poging, en gooit hem pas weg na succes. Mislukt een
poging, dan blijft de sleutel staan — opnieuw proberen is dezelfde handeling.

Serverkant: bestaanscontrole vooraf, plus de unique index als echte garantie.
`IdempotencyConflictError` is geen storing maar het signaal dat een gelijktijdig
verzoek won; de verliezer geeft het document van de winnaar terug.

Gedrag per status van een eerdere poging: AVAILABLE → teruggeven;
PENDING/FAILED → dezelfde rij afmaken op dezelfde storage key; DELETED/EXPIRED →
niet laten herleven (dat zou een verwijdering stil terugdraaien).

Acht databasetests, waaronder:

- **de checksum blokkeert géén bewuste tweede upload** — dezelfde bytes met twee
  verschillende sleutels geven twee documenten, beide AVAILABLE, met dezelfde
  checksum. De gebruiker krijgt het wél te horen via `duplicateOf`;
- **zonder sleutel geen bescherming, maar ook geen weigering** — twee NULL-en
  botsen niet in een unique index;
- **de sleutel van Bob raakt Alice niet** — de index staat op `(userId, key)`;
- **de database dwingt het af** — een insert die om de service heen gaat, faalt
  met P2002.

## 14. Storage filesystem-tests

14 tests op een **echte** wegwerpmap in de temp-directory, niet op een in-memory
Map. Een Map heeft geen paden, geen mappen en geen ENOENT; hij zou juist de
fouten missen die hier gevonden moeten worden.

Getest: wegschrijven inclusief ontbrekende submappen; exact dezelfde bytes terug
(binair, met nulbyte); overschrijven zonder rest van de oude inhoud; `exists`;
`getMetadata` geeft `null` in plaats van een fout als er niets is; `get` op een
ontbrekend bestand geeft `StorageError`; **de foutmelding lekt het absolute pad
niet**; delete wist echt; tweede delete slaagt gewoon; padtraversal (`../`,
absoluut pad) geweigerd én het bestand erbuiten ongemoeid; gesigneerde URL
verifieert zichzelf en weigert vervalsing, andere sleutel, ander tijdstip en
verlopen tijd; 5 MB payload komt ongeschonden terug.

De map wordt na afloop verwijderd, en dat wordt geassert.

## 15. Gevonden bugs

**Bug 1 — het afhankelijkheidsmodel kende geen onderscheid tussen blokkerend en
adviserend.** *(Alleen zichtbaar via een databasetest.)*

Symptoom: `FINANCING_COMPARE_OPTIONS` bleef op TODO staan waar COMPLETED
verwacht werd. Oorzaak: de taak hangt via `FINANCING_DETERMINE_NEED` →
`BUDGET_SET_MAX_PRICE` → `BUDGET_ESTIMATE_COSTS` aan een keten open taken.
`setTaskStatus` weigerde te voltooien bij élke open afhankelijkheid, en
`syncFinancingTasks` slikte de `ConflictError`. De gebruiker deed het werk, en
het systeem registreerde het niet.

Mocks konden dit niet vangen: ze hebben geen afhankelijkheidsgraaf.

Oplossing: `TaskDependencyType { BLOCKING, ADVISORY }`. Alleen BLOCKING
verhindert voltooiing. Vijf afhankelijkheden zijn blokkerend — precies die waar
schade ontstaat, met "bieden zonder financieringsbewijs" voorop. De rest is
volgorde-advies in de UI. Het schemacommentaar had dit onderscheid al
aangekondigd ("blokkerend vs. adviserend … zonder migratie").

Twee journey-integratietests testten daarna gedrag dat we bewust hadden
gewijzigd. Ze zijn opnieuw gericht op een écht blokkerend paar, en er zijn
**twee tests bijgekomen** in plaats van dat de oude alleen verzwakt werden.

**Bug 2 — de seed legde geen blokkerende afhankelijkheden vast.** Zie punt 5.
Elke geseede ontwikkelomgeving miste de bescherming die het platform hoort te
bieden.

**Bug 3 — geen echte upload-idempotentie.** Zie punt 13. Was bekend en
gedocumenteerd als beperking; nu opgelost.

## 16. Schemawijzigingen

```prisma
enum TaskDependencyType { BLOCKING  ADVISORY }

model TaskDependency {
  type TaskDependencyType @default(ADVISORY)
}

model Document {
  idempotencyKey String?
  @@unique([userId, idempotencyKey])
}
```

`TaskDependencyType` zit in `20260807000000_init` (er is nog geen uitgerolde
database). `idempotencyKey` heeft een eigen incrementele migratie,
`20260809000000_document_idempotency_key`, zodat het migratiepad zelf getest
wordt in plaats van weggepoetst.

De kolom is optioneel: PostgreSQL behandelt NULL-waarden in een unique index als
onderling verschillend, dus uploads zonder sleutel botsen nooit met elkaar.

## 17. Unit tests

**671 geslaagd, 34 bestanden, 0 overgeslagen.** Drie keer achter elkaar gedraaid
(gevraagd vanwege de concurrency- en idempotentiewijzigingen), drie keer
identiek groen.

Was 666; +5 door de nieuwe suite "wat het filter aantoonbaar niet vangt" — zie
punt 19.

## 18. Integratietests

**131 geslaagd, 9 bestanden, 0 overgeslagen.** Tegen echte PostgreSQL 17.

Was: 68 geschreven, 0 uitgevoerd.

## 19. Build, typecheck, lint

| | |
|---|---|
| `prisma format` | ✅ |
| `prisma validate` | ✅ schema geldig |
| `prisma generate` | ✅ client v6.19.3 |
| `tsc --noEmit` | ✅ geen fouten (strict, `noUncheckedIndexedAccess`) |
| `eslint .` | ✅ geen meldingen |
| `vitest run` | ✅ 671/671, 3× |
| `test:integration` | ✅ 131/131 |
| `build:webpack` | ✅ alle routes gebouwd |
| migratiedrift | ✅ leeg |

Twee inhoudelijke wijzigingen buiten de tests om:

**De uitleg-UI zegt nu vooraf waar de uitleg op gebaseerd is.** Er is geen
tekstextractie; geen provider leest het bestand. Dat stond alleen in een
voetnoot ná de uitleg, en alleen bij de fixture-bron. Nu staat er
onvoorwaardelijk bovenaan, vóór de inhoud: *"Gebaseerd op de documentsoort, niet
op je bestand."* Iemand die "waar mensen doorgaans op letten" aanziet voor "wat
er in jouw compromis staat", tekent op basis van een uitleg die zijn document
nooit gezien heeft.

**De juridische guardrails zijn scherp gedocumenteerd als heuristiek.** Vier
lagen — systeeminstructie → gestructureerde output → deterministisch filter →
UI-disclaimer — en bij elke laag staat wat hij *niet* kan. Geen enkele is op
zichzelf voldoende, en samen zijn ze dat ook niet. Er is nu een testsuite die
vastlegt wat het filter aantoonbaar mist: een geruststelling zonder de
gemarkeerde woorden, hetzelfde oordeel in het Frans of Engels, een oordeel dat
over twee zinnen verdeeld staat, een impliciete geruststelling over een clausule.
Die tests zijn geen todo-lijst; ze zijn documentatie in uitvoerbare vorm, zodat
niemand op basis van dit bestand concludeert dat juridisch advies "geblokkeerd
wordt".

## 20. Wat nog echte S3/R2 vereist ❌

Niet geïmplementeerd, en dat wordt nergens anders beweerd.
`getStorageProvider()` gooit een expliciete fout bij `STORAGE_PROVIDER=s3`.

Openstaand bij een echte objectopslag:

- de `StorageProvider`-implementatie zelf (het interface staat vast, dus geen
  aanroeper hoeft te veranderen);
- **een andere autorisatiesituatie.** Bij de lokale provider is de gesigneerde
  URL een verwijzing naar onze eigen route, die de sessie nog eens controleert —
  twee sloten. Een presigned S3-URL is toegang op zichzelf: wie hem heeft, kan
  bij het bestand. De TTL wordt daar de enige bescherming;
- encryptie at rest, bucketbeleid (privé, geen listing), en een levenscyclusregel
  die aansluit op `purgeOrphans()`;
- de integratietests op echte objectopslag herhalen. De huidige suite bewijst
  het filesystem-gedrag, niet het S3-gedrag.

## 21. Wat nog een echte AI-provider vereist ❌

Alleen de fixture-provider draait. `AiExplanationProvider` is wél aangesloten —
`getExplanationProvider()` kiest hem bij `AI_ENABLED=true` — maar hij is nooit
tegen een echte sleutel uitgevoerd, en `AI_ENABLED` staat standaard uit.

Openstaand:

- tekstextractie uit PDF's. Zonder dat blijft elke uitleg over de documentsoort
  gaan en niet over het document — zie punt 19;
- **de privacyafweging opnieuw maken.** Nu ontvangt een model alleen categorie
  en wat metadata: geen persoonsgegevens. Zodra er extractie is, gaat er
  contractinhoud naar buiten, en dan moeten `describeDataSentToProvider()`, de
  UI-tekst en het privacybeleid alle drie mee veranderen;
- rate limiting, kostenbewaking, en gedrag bij een provider die traag is of
  wegvalt;
- de guardrails aanscherpen tégen model-output in plaats van tegen fixtures — met
  de kanttekening uit punt 19 dat dat de aard van de bescherming niet verandert.

## 22. Wat nog een productie-scheduler vereist ❌

`purgeOrphans()` en `reconcileDocument()` bestaan en zijn getest, maar niets
roept ze periodiek aan.

Openstaand:

- een cron of queue-worker die `purgeOrphans()` draait (een cron job in de
  hostingomgeving volstaat);
- een lock of leader election zodra er meer dan één instantie draait. De functie
  is aantoonbaar veilig bij overlap (punt 11), dus dit is een efficiëntievraag,
  geen correctheidsvraag;
- observability: hoeveel weeskandidaten er per ronde zijn en of dat aantal
  oploopt. Een stille opruimtaak die faalt, is niet te onderscheiden van een
  opruimtaak die niets te doen heeft;
- verlopen documenten (`expiresAt`) op EXPIRED zetten — de statuswaarde bestaat,
  maar niets zet hem.

## 23. Concrete scope voor Fase 6

Voorstel, op volgorde van waarde voor de gebruiker:

**A. Notaris- en afspraakflow afmaken.** Het notarismodule-domein
(`be.notary.deed`) en de begeleiding staan er; wat ontbreekt is de flow waarin
een gebruiker een akte-afspraak plant, de checklist eraan hangt en het
document-bewijs verzamelt. Dit sluit de laatste fase van het traject.

**B. Verlopen documenten en herinneringen.** `expiresAt` en de EXPIRED-status
bestaan maar worden nergens gebruikt. Een loonfiche van vier maanden oud wordt
door een bank niet meer aanvaard; de gebruiker hoort dat te weten vóór hij bij
de notaris zit. Vereist punt 22 (scheduler) — de kleinste van de drie
openstaande infrastructuurpunten.

**C. Voortgang en overzicht.** Eén scherm dat traject, checklists, documenten en
financiering samenbrengt, met wat er nú aan de beurt is. Alle onderliggende data
bestaat al; dit is samenstellen, geen nieuwe domeinlogica.

**Bewust niet in Fase 6**, tenzij je anders beslist: een echte vastgoedbron
(geen toegestane API of credentials), echte financieringsaanbieders (geen
geverifieerde bron), en S3 (geen bucket). Die drie blijven staan waar ze staan —
expliciet open, niet stilzwijgend half af.
