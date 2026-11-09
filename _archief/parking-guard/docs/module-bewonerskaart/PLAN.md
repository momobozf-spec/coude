# Module Bewonerskaart — Audit & Plan

Status: **Fase 0 in uitvoering**
Laatst bijgewerkt: 2026-08-29

Dit document is het resultaat van Stap 0 (audit) uit `BRIEF.md`, plus het
uitvoeringsplan. Het is geschreven om na een verse sessie of een overdracht
direct bruikbaar te zijn: wat is er, wat is er niet, en wat is de volgende stap.

---

## 1. Auditresultaat

### 1.1 Wat de repository is

De geopende repository (`coude`, branch `main`) is **geen Parking Guard-repo**.
Het is een persoonlijke werkruimte met ~30 losstaande projecten naast elkaar in
de root — `immoradar-belgium/`, `woningalert/`, `fsbo-lead-radar/`, `orbit/`,
`halal-scanner/`, `zakat-platform/` en meer. Elk project is een eigen,
zelfstandige applicatie met een eigen `package.json`, `prisma/` en
`node_modules/`. Er is geen workspace-root, geen gedeeld pakket, geen monorepo-
tooling. `AGENTS.md` in de root bevestigt dat: *"this are all my project made by
claude code"*.

**Gevolg voor deze opdracht:** Parking Guard wordt een nieuw, zelfstandig project
in `parking-guard/`, volgens hetzelfde patroon als de buurprojecten. Er wordt
niets aan bestaande projecten gewijzigd.

### 1.2 Bestaan pijler 1 (Live Alerts) en pijler 2 (Boete aanvechten)?

**Nee.** Er is geen platform om op verder te bouwen. Wat er wél is:

`parking-brussel-helper/` — vier bestanden (`index.html`, `app.js`,
`styles.css`, `README.md`). Een statische, offline HTML-app zonder build, zonder
server, zonder database; alle state in `localStorage`. Het is een
voorbereidings-hulpje: het bouwt bezwaartekst op die de gebruiker daarna zélf in
het officiële Parking.brussels-formulier plakt. De README zegt dat ook expliciet.

Dit is **geen** implementatie van pijler 2. Het is een prototype.

Het bevat wel bruikbare **domeinkennis**, die ik als startpunt voor het onderzoek
gebruik (en per feit alsnog tegen een officiële bron verifieer, zie §3):

- Brusselse parkeerzones en de bijbehorende retributiebedragen (blauw/groen/
  grijs/rood/oranje/evenement/levering/kiss&ride)
- Een documentchecklist voor kentekenwijziging op een bewonerskaart —
  identiteitskaart recto-verso, inschrijvingsbewijs recto-verso, leasing-/
  huurcontract, attest enige gebruiker bij bedrijfswagen, garageattest bij
  tijdelijk vervangvoertuig
- Officiële Parking.brussels-routes (e-loket, retributies/bezwaarschriften,
  parkeerzones, contact)

Deze checklist is precies de kern van `MunicipalityConfig.requiredDocuments` —
maar hij komt uit een prototype, niet uit een geverifieerde bron, en gaat dus als
**UNVERIFIED** de registry in tot ik hem per gemeente tegen de officiële site heb
gelegd.

**Conclusie:** module 3 is de eerste échte module van het platform. De fundering
moet mee gebouwd worden, met een expliciete plek voor pijler 1 en 2 later.

### 1.3 Bestaande stack, auth, betalingen, datamodellen

Er is niets van dit alles voor Parking Guard. Maar er is een duidelijke,
consistente **huisstijl** in de recentste projecten (`immoradar-belgium`,
`fsbo-lead-radar`, `woningalert`), en die volg ik — dat is wat "bouw daarop
verder" hier redelijkerwijs kan betekenen:

| Laag | Huisconventie | Bron |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript strict + `noUncheckedIndexedAccess` | alle drie |
| Styling | Tailwind 4 via `@tailwindcss/postcss`, geen component-library geïnstalleerd | alle drie |
| Database | PostgreSQL + Prisma 6, echte migrations, `prisma.config.ts` | alle drie |
| Lokale DB | `embedded-postgres` in `.devdb/` via `npm run dev:db` — géén Docker nodig | `immoradar-belgium/scripts/dev-db.ts` |
| Achtergrondwerk | `src/jobs/worker.ts` + `src/jobs/cli.ts`, gedraaid met `tsx` | immoradar, fsbo |
| Tests | Vitest + `vite-tsconfig-paths`, tests in `tests/`, Playwright voor e2e | woningalert |
| Lint | ESLint 9 flat config, `no-explicit-any: error`, import-restricties die rekenlagen puur houden | immoradar |
| Env | Eén `src/lib/env.ts` met Zod-validatie; secrets nergens anders | immoradar |
| Logging | Gestructureerd, JSON per regel, **redaction in de logger zelf** | immoradar |
| Auth | Zelfgebouwde scrypt-hash + HMAC-ondertekend httpOnly-cookie | immoradar |
| Security | CSP en security headers in `next.config.ts`, `no-store` op `/api/*` | immoradar |
| Taal | Commentaar en UI in het Nederlands; commentaar legt *waarom* uit, niet *wat* | alle drie |
| Verificatie | `npm run verify` = validate → typecheck → lint → test → build | woningalert |

`npm run verify` neem ik letterlijk over — dat is de gate uit werkregel 5.

### 1.4 Omgeving

- Node v24.19.0, npm 11.17.0
- **Geen Docker**, **geen psql**, **geen Redis** op deze machine

Dat laatste stuurt twee architectuurbeslissingen (ADR 0002 en 0003 hieronder).

---

## 2. Beslissingen die uit de audit volgen

Vier keuzes wijken af van of vullen de brief in. Ze staan uitgeschreven als ADR
in `docs/decisions/`; hier de kern.

**ADR 0001 — Nieuw project `parking-guard/`, pijler 3 eerst.**
Geen voortbouw op `parking-brussel-helper` (statisch prototype, geen fundering).
De mappenstructuur reserveert vanaf dag één `src/domain/alerts/` en
`src/domain/appeals/` voor pijler 1 en 2, zodat die later landen zonder
verbouwing. Gedeelde lagen (auth, betalingen, entitlements, storage, mail, jobs)
worden module-onafhankelijk gebouwd.

**ADR 0002 — Jobs: driver-interface, Postgres standaard, BullMQ op `REDIS_URL`.**
De brief vraagt Redis + BullMQ. Redis is hier niet beschikbaar en Docker ook
niet, dus een BullMQ-only opzet zou betekenen dat de retentie-job, de
reminder-job en de extractie-queue in de Definition of Done **niet aantoonbaar
werken** — precies wat werkregel 1 verbiedt. Daarom één `JobQueue`-interface met
twee echte drivers: een Postgres-driver (`SELECT … FOR UPDATE SKIP LOCKED`) die
standaard aanstaat en volledig werkt, en een BullMQ-driver die aangaat zodra
`REDIS_URL` gezet is. Beide echt; de BullMQ-driver staat als
`CONFIGURATION REQUIRED` in `INTEGRATIONS.md`. De aparte worker (`npm run
worker`) bestaat in beide gevallen.

**ADR 0003 — Storage: S3-driver + lokale encrypted-filesystem-driver.**
Zelfde redenering. `S3DocumentStore` (AWS SDK v3, werkt tegen Cloudflare R2 en
Scaleway, EU-regio, SSE) is de productiedriver en staat als
`CONFIGURATION REQUIRED`. Daarnaast een `LocalDocumentStore` die naar `.storage/`
schrijft met AES-256-GCM at rest — niet een mock, maar een tweede echte
implementatie van dezelfde interface, zodat de upload-, retentie- en
verwijderflows lokaal en in CI end-to-end te testen zijn. `.storage/` staat in
`.gitignore`; documenten komen nooit in git en nooit in de database.

**ADR 0004 — Auth: huisconventie in plaats van Auth.js.** *(open punt, zie §5)*
De brief zegt "bestaand systeem hergebruiken; anders Auth.js". Er ís geen
bestaand systeem. De huisconventie is een zelfgebouwde sessielaag, en
`immoradar-belgium/src/lib/session.ts` documenteert expliciet waarom next-auth
daar is afgewezen. Dat argument gold een B2B-dashboard zonder zelfregistratie;
Parking Guard is een consumentenproduct mét zelfregistratie en e-mailverificatie,
dus het weegt hier minder zwaar. Ik toets eerst of `next-auth` v5 schoon draait
op Next 16; zo ja, dan Auth.js zoals gevraagd. Zo nee, dan de huisconventie
uitgebreid met e-mailverificatie, wachtwoordherstel en RBAC — functioneel
gelijkwaardig. De uitkomst leg ik vast in de ADR zodra ik het gemeten heb, niet
op voorhand.

---

## 3. Gemeente-onderzoek: de aanpak

Dit is het fundament en tegelijk het grootste risico op stilzwijgende
verzinsels. Werkwijze, strikt:

1. Per entry (19 gemeenten + parking.brussels) alleen **officiële bronnen**: de
   gemeentesite zelf (`.brussels`, `.irisnet.be`, gemeentelijke domeinen) en
   `parking.brussels`. Geen blogs, geen nieuwsartikelen, geen aggregators.
2. Elk veld krijgt in `docs/gemeenten.md` een **bron-URL en raadpleegdatum**.
3. Wat ik niet kan staven: veld leeg, `verificationStatus = UNVERIFIED`.
   **Nooit een e-mailadres, tarief of documentvereiste invullen dat ik niet op
   een officiële pagina heb gelezen.** Een verzonnen indieningsadres is de ergste
   bug die dit product kan hebben: het dossier met iemands identiteitskaart komt
   dan bij een vreemde terecht.
4. `verifiedAt` ouder dan 6 maanden → automatisch `STALE`.
5. De seed is **reference-data, geen demo-data**: hij bevat alleen wat
   geverifieerd is, inclusief eerlijke `UNVERIFIED`-markeringen voor de rest.

De blokkade is technisch, niet alleen procedureel: verzending naar een entry die
niet `VERIFIED` is, wordt in de verzendlaag geweigerd — de UI toont dan "Deze
gemeente wordt binnenkort ondersteund" en biedt het dossier als download aan, en
er is geen codepad dat daar omheen gaat.

Een realistische verwachting vooraf: het is waarschijnlijk dat een deel van de 19
gemeenten geen publiek indieningsadres voor bewonerskaarten publiceert (veel
werken via een eigen e-loket of via parking.brussels). Die komen dan als
`UNVERIFIED` in de registry met de download-route als uitweg. Dat is het eerlijke
resultaat, en het is bruikbaar — niet een tekortkoming die ik wegpoets.

---

## 4. Faseplan en status

Verificatie-gate per fase: `npm run verify` groen (validate → typecheck → lint →
test → build), dan pas commit. `PROGRESS.md` en `INTEGRATIONS.md` worden per fase
bijgewerkt.

| Fase | Inhoud | Status |
|---|---|---|
| **0** | Audit, scaffold, gemeente-onderzoek, registry-seed, Prisma-schema + migrations | **bezig** |
| **1** | Upload & opslag: secure pipeline, DocumentStore-drivers, retentie-job, documentbeheer | open |
| **2** | Extractie & validatie: `DocumentExtractor` + adapter, validatieregels, correctie-UI | open |
| **3** | Wizard (4 types, NL/FR), volmacht + consents, dossier-PDF | open |
| **4** | Verzending & opvolging: mail out/in, statuslifecycle, admin-reviewqueue, supervised mode, reminders | open |
| **5** | Betalingen (Mollie), export/verwijdering, DPIA-aanzet, E2E, launch-checklist | open |

### Fase 0 — resterende stappen

- [x] Repo-audit
- [x] Projectscaffold + dependency-installatie
- [x] `PLAN.md` (dit document)
- [ ] ADR's 0001–0004 uitschrijven
- [ ] Gemeente-onderzoek → `docs/gemeenten.md` met bronnen per veld
- [ ] Prisma-schema (volledig datamodel uit de brief) + eerste migration
- [ ] Registry-seed uit het onderzoek
- [ ] Basislagen: `env.ts`, `logger.ts`, `db.ts`, `/api/health`
- [ ] `PROGRESS.md`, `INTEGRATIONS.md`, `README.md`
- [ ] `npm run verify` groen → commit

**Exit-criterium fase 0:** registry gevuld met eerlijk gemarkeerde
verificatiestatussen, migrations draaien, CI groen.

---

## 5. Open punten voor de opdrachtgever

Geen van deze blokkeert de voortgang — ik werk door onder de vermelde aanname en
kom erop terug.

1. **Auth.js of huisconventie** (ADR 0004). Aanname: ik meet het en kies op het
   resultaat. Geen kostenimpact.
2. **Juridische teksten.** De volmachttekst en de consent-teksten worden
   geschreven als duidelijk gemarkeerde placeholder met versienummer
   (`textVersion` op het `Mandate`-record), te valideren door een jurist vóór
   lancering. `docs/privacy.md` vermeldt dat expliciet.
3. **Kosten.** Alles wat tot nu toe gekozen is, is open source of gratis in
   ontwikkeling. Betaalde diensten komen pas aan de orde bij de keys in
   `INTEGRATIONS.md` (vision-API, Resend, Mollie, R2/Scaleway) — daar meld ik me
   vóór ik iets aanmaak, conform werkregel 5.
4. **Rijksregisternummer.** Aanname: we slaan het standaard **niet** op, en het
   veld gaat pas aan per gemeente die het aantoonbaar vereist. Zie
   `docs/privacy.md`.
