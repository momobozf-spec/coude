# Architectuur — Halal Product Scanner

Status: **Fase 1 afgerond** (architectuur + database). Fase 2 t/m 8 volgen.

---

## 1. Uitgangspunt

De applicatie mag **geen religieuze zekerheid veinzen wanneer de data
onvoldoende is**. Dat is geen UI-detail maar een architectuurbeslissing, en het
loopt door het hele systeem:

| Beslissing | Waar afgedwongen |
|---|---|
| Elke classificatie is herleidbaar naar een bron | `Source` + `AnalysisFinding.sourceId` |
| Eigen heuristiek is zichtbaar geen autoriteit | `SourceType.INTERNAL_RULE` |
| Geen universele religieuze waarheid gehardcodeerd | `ENumberRuling` / `IngredientRuling` per `CertificationBody` |
| AI doet geen eindoordeel | AI-output gaat via validatie de rules engine in; nooit direct naar `Product.halalStatus` |
| Geuploade certificaten zijn niet meteen geldig | `CertificateStatus` start op `PENDING` |
| Onbekend ≠ goed | Aparte statussen `MUSHBOOH` en `UNKNOWN`, niet samengevouwen met `LIKELY_HALAL` |

De statuswaarden zijn bewust fijnmaziger dan halal/haram/mushbooh, zodat
"gecertificeerd" en "ziet er plausibel uit" niet op elkaar lijken in de UI.

---

## 2. Stack

| Laag | Keuze | Waarom |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript strict | Eén codebase voor UI en API; server components houden data-fetching uit de client |
| Styling | Tailwind CSS 4 | Mobile-first, geen runtime-kosten |
| Backend | Next.js Route Handlers | Geen aparte service nodig: er is geen langlopend werk dat buiten een request valt. Wordt heroverwogen zodra OCR-jobs asynchroon moeten |
| Database | PostgreSQL + Prisma | Relationeel model met echte constraints; `String[]` en partial indexes worden gebruikt |
| Barcode | `@zxing/browser` | Actief onderhouden, werkt met `getUserMedia`; scanning gebeurt volledig client-side |
| AI | Provider-abstractie (OpenAI / Anthropic / none) | Alleen voor normalisatie, OCR en uitleg — niet voor classificatie |
| Storage | Provider-abstractie (local / S3-compatibel) | Lokaal filesystem in dev, S3/R2/Supabase in productie |
| Tests | Vitest | Rules engine en parsing zijn pure functies; die zijn zonder database testbaar |

**Geen aparte Express/Fastify backend.** De enige architecturale reden zou een
achtergrondqueue zijn. OCR draait nu synchroon binnen het request; zodra dat
knelt, komt er een worker die dezelfde `src/server/` services aanroept. Die
services zijn daarom Next-onafhankelijk geschreven.

---

## 3. Lagen

```
  React components         ← geen businesslogica, geen database
        ↓
  Route Handlers           ← Zod-validatie, rate limiting, authz
        ↓
  Services                 ← use cases (lookup, analyse, verificatie)
        ↓
  ┌──────────────┬──────────────────┬─────────────────┐
  │ Repositories │ Halal engine     │ Integrations    │
  │ (Prisma)     │ (pure functies)  │ (OFF, AI, S3)   │
  └──────────────┴──────────────────┴─────────────────┘
```

Twee harde regels:

1. **Geen Prisma-query buiten `src/server/repositories/`.** Componenten en
   route handlers krijgen domeintypes, geen Prisma-modellen.
2. **De halal-engine kent geen database.** `src/server/halal/` bevat pure
   functies over gewone objecten. Dat maakt de kernlogica testbaar zonder
   Postgres en herbruikbaar in een toekomstige native app of worker.

---

## 4. Mappenstructuur

```
halal-scanner/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/20260807000000_init/migration.sql
│   ├── seed.ts
│   └── seed-data/            sources, certification-bodies, e-numbers, ingredients
│
├── src/
│   ├── app/
│   │   ├── api/              route handlers
│   │   ├── scan/             barcode scanner
│   │   ├── product/          productpagina met tabs
│   │   ├── search/
│   │   ├── community/
│   │   └── admin/            protected
│   │
│   ├── components/           scanner/ product/ halal/ certificate/ community/
│   │
│   ├── server/
│   │   ├── services/         use cases
│   │   ├── repositories/     enige plek met Prisma-queries
│   │   ├── integrations/     openFoodFacts/ ai/ storage/
│   │   ├── halal/            engine/ rules/ normalizers/   ← pure, testbaar
│   │   └── validators/       Zod-schema's per endpoint
│   │
│   ├── lib/                  prisma client, logger, rate limiter, utils
│   ├── types/                domeintypes (halal.ts, product.ts)
│   └── config/               env.ts
│
├── docs/                     ARCHITECTURE.md, DECISION-TREE.md
├── tests/                    Vitest
├── Dockerfile
└── docker-compose.yml
```

---

## 5. Datamodel — de niet-vanzelfsprekende keuzes

### Analyses zijn geversioneerd, niet overschreven

`Product.halalStatus` is een **cache** voor lijstweergaven. De bron van waarheid
is de meest recente `ProductAnalysis` met bijbehorende `AnalysisFinding`-rijen.
Daardoor is achteraf te reconstrueren waarom een product op een bepaald moment
een bepaalde status kreeg — ook nadat de regels zijn aangepast.

`ProductAnalysis.inputHash` + `engineVersion` samen bepalen of her-analyse nodig
is. Zelfde input, zelfde engineversie → hergebruik.

### Verschillende autoriteiten, verschillende oordelen

`ENumber.defaultStatus` is **ons** conservatieve oordeel, gemarkeerd met een
`INTERNAL_RULE`-bron. Daarnaast bestaat `ENumberRuling`: één rij per
(E-nummer, certificerende instantie). Zo kan JAKIM iets anders vinden dan HFA
zonder dat één van beide "de waarheid" wordt.

`CertificationBody.hasImportedRulings` staat op `false` zolang wij geen
geverifieerde uitspraken van die instantie hebben geïmporteerd. De UI mag dan
niet suggereren dat er een oordeel van die instantie bestaat.

### Onbekende ingrediënten verdwijnen niet

`ProductIngredient.ingredientId` mag `null` zijn. `rawName` en
`normalizedName` blijven altijd bewaard. Een ingrediënt dat we niet kennen wordt
zichtbaar als onbekend — het valt niet stilzwijgend weg uit de analyse.

### Certificaten: XOR en niet-optimistische defaults

Een `Certificate` hangt aan een product **of** aan een merk, afgedwongen met een
CHECK-constraint. Nieuwe uploads krijgen `PENDING`; alleen een moderator kan naar
`VERIFIED`. Zie [DECISION-TREE.md](DECISION-TREE.md).

### Stemmen zijn rijen, geen teller

`ReviewVote` heeft `@@unique([reviewId, userId])` plus een CHECK op `vote IN
(-1, 1)`. `CommunityReview.score` is een afgeleide cache die uitsluitend uit de
votes-tabel herberekend wordt, nooit door een client gezet.

### JSON alleen waar relationeel niets oplevert

Eén veld gebruikt `Json`: `AuditLog.metadata`. De vorm verschilt per event en er
wordt niet relationeel op gequeried. Alles wat betekenis heeft voor de analyse
is relationeel gemodelleerd.

---

## 6. Modellen

| Groep | Modellen |
|---|---|
| Gebruikers | `User`, `Account`, `Session`, `VerificationToken` |
| Bronnen | `Source`, `CertificationBody` |
| E-nummers | `ENumber`, `ENumberSource`, `ENumberRuling` |
| Ingrediënten | `Ingredient`, `IngredientAlias`, `IngredientSource`, `IngredientRuling` |
| Producten | `Brand`, `Product`, `ProductIngredient` |
| Analyse | `ProductAnalysis`, `AnalysisFinding` |
| Certificaten | `Certificate` |
| Community | `CommunityReview`, `ReviewVote`, `Report` |
| OCR | `OcrSubmission` |
| Activiteit | `Favorite`, `ScanEvent`, `AuditLog` |

Enums: `UserRole`, `HalalStatus`, `ConfidenceLevel`, `OriginRisk`,
`IngredientCategory`, `SourceType`, `ExternalSource`, `IngredientOrigin`,
`CertificateStatus`, `ReviewType`, `ReviewStatus`, `ReportType`, `ReportStatus`,
`FindingType`, `OcrStatus`.

---

## 7. Multi-user en SaaS-groeipad

Wat nu al klaarstaat, zonder dat auth is uitgewerkt:

- `User` met `role`, plus `reputationScore` en `verifiedContributor` als
  voorbereiding op reputatie (§22).
- `Account`/`Session`/`VerificationToken` zijn Auth.js-compatibel: inpluggen
  vraagt geen datamigratie.
- Alle door gebruikers aangemaakte content heeft al een `userId`.
- Moderatie-acties gaan naar `AuditLog`.

Wat bewust **niet** in de MVP zit: organisaties/tenants. Zolang de data publiek
en gedeeld is, voegt een tenant-kolom alleen complexiteit toe. Een B2B-variant
zou `Organization` toevoegen en `Certificate`/`Report` eraan koppelen.

---

## 8. Volgende fases

| Fase | Inhoud | Status |
|---|---|---|
| 1 | Architectuur, Prisma schema, enums, `.env.example`, seed | **klaar** |
| 2 | Open Food Facts client, normalisatie, barcode lookup API, persistence | open |
| 3 | Rules engine, E-nummerdetectie, findings, analysehistoriek | open |
| 4 | Scanner-UI, camera permissions, productpagina | open |
| 5 | OCR: upload, vision-abstractie, gebruikersbevestiging | open |
| 6 | Certificaten: upload, verificatieworkflow, badges, expiratie | open |
| 7 | Community: reviews, voting, reporting, moderatie | open |
| 8 | Tests, security, PWA, Docker, README, accessibility, logging | open |
