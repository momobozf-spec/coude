# Opdracht — Module 3: Bewonerskaart Service

Dit is de opdracht zoals gegeven. Het uitvoeringsplan en de audit staan in
[`PLAN.md`](PLAN.md); de voortgang in [`../../PROGRESS.md`](../../PROGRESS.md).

---

## Context

Parking Guard Brussel is een consumentenplatform voor Brusselaars met drie
pijlers:

1. LIVE ALERTS — crowdsourced scanauto-notificaties
2. BOETE AANVECHTEN — automatisch bezwaarschrift bij parkeerretributies
3. BEWONERSKAART — aanvragen, verlengen of kenteken/adres wijzigen *(deze opdracht)*

Het probleem: een bewonerskaart aanvragen of wijzigen (nieuwe auto,
vervangwagen, verhuizing) bij een Brusselse gemeente of parking.brussels is
administratieve rompslomp met veel documenten. Wij maken daar een mobiele wizard
van: documenten fotograferen, AI leest de gegevens uit, wij stellen het dossier
samen en dienen het in bij de juiste administratie, met statusopvolging in het
dashboard.

## Stap 0 — Audit eerst

Inspecteer de volledige repository voordat je iets bouwt.

- Bestaan pijler 1 en/of 2 al? Rapporteer welke stack, auth, betalingen en
  datamodellen er al zijn en bouw module 3 daarop verder. Breek niets.
- Is de repo leeg? Rapporteer dat en scaffold dan eerst een minimale fundering
  waarin module 3 als eerste module landt, met duidelijke plek voor pijler 1 en 2.
- Schrijf bevindingen en plan in `docs/module-bewonerskaart/PLAN.md`.

## Bindende werkregels

1. **Geen mocks in productieflows.** Alles wat de UI als werkend toont, werkt
   echt. Externe integraties die credentials nodig hebben bouw je volledig af en
   markeer je als `CONFIGURATION REQUIRED` in `INTEGRATIONS.md` — nooit als
   "working" presenteren.
2. **Eerlijke automatisering.** Claim nergens dat iets "100% automatisch" is als
   er een menselijke of onzekere stap in zit. Statusupdates van gemeenten komen
   via antwoordmail-parsing of manuele invoer — benoem dat zo.
3. **Supervised mode is verplicht en staat standaard AAN.** Geen enkel dossier
   wordt automatisch verzonden: elk dossier komt eerst in een
   admin-reviewwachtrij. Pas als per gemeente expliciet "auto-send" geactiveerd
   is, mag verzending zonder review — en zelfs dan alleen na expliciete
   eindbevestiging van de gebruiker zelf.
4. **Geverifieerde gemeente-data of geen verzending.** Verzenden via een
   ongeverifieerd kanaal is technisch geblokkeerd.
5. **Gefaseerd werken** met verificatie-gate per fase: typecheck → lint → unit
   tests → build groen, dan commit. Houd `PROGRESS.md` en `INTEGRATIONS.md` bij.
   Documenteer belangrijke keuzes als ADR's in `docs/decisions/`. Onderbreek
   alleen bij kosten- of juridische beslissingen.
6. Bij volle context: eerst `PROGRESS.md` bijwerken.

## Tech stack

Tenzij de audit iets anders aantreft — dan volg je het bestaande.

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, mobile-first
- PostgreSQL + Prisma (echte migrations), Redis + BullMQ, aparte worker
- Auth: bestaand systeem hergebruiken; anders Auth.js met e-mailverificatie
- Storage: S3-compatibel (Cloudflare R2 of Scaleway, EU-regio), server-side
  encryptie; nooit documenten in de database of in git
- Vision/OCR: provider-agnostische `DocumentExtractor` met adapter voor een
  vision-LLM. EU-endpoint / no-training waar beschikbaar.
  `CONFIGURATION REQUIRED` tot er API-keys zijn.
- E-mail: Resend uitgaand; dedicated inbox voor gemeente-antwoorden via inbound
  webhook — `CONFIGURATION REQUIRED`
- Betalingen: Mollie (iDEAL, Bancontact, creditcard)
- Sentry + pino structured logging + `/api/health`
- Zod op alle input; RBAC voor admin

## Juridisch & privacy-kader

Dit product verwerkt identiteitskaarten en kentekenbewijzen.

1. **Volmacht-flow**: vóór indiening ondertekent de gebruiker digitaal (checkbox
   + naam + timestamp + IP, vastgelegd als `Mandate`) een volmacht. De
   volmacht-PDF gaat mee in het dossier. Juridische tekst als duidelijk
   gemarkeerde placeholder.
2. **Dataminimalisatie**: alleen velden die de gemeente vereist.
   **Rijksregisternummer**: niet in platte tekst opslaan; alleen tijdelijk
   verwerken indien vereist, gemaskeerd tonen (`xx.xx.xx-xxx.xx`), encrypted at
   rest, in het retentiebeleid. Documenteer in `docs/privacy.md` waarom elk veld
   verwerkt wordt.
3. **Retentie**: brondocumenten automatisch verwijderen X dagen na afronding
   (default 30, admin-configureerbaar); background job + auditlog. Gebruiker kan
   eerder verwijderen.
4. **Consent**: apart en expliciet voor (a) verwerking identiteitsdocumenten,
   (b) doorgifte aan de AI-provider, (c) indiening bij de administratie. Geen
   vooraf aangevinkte boxes.
5. **Beveiliging**: signed URLs met korte TTL, access-logging op elk
   documentbezoek, encryptie at rest en in transit, geen documentinhoud of
   persoonsgegevens in logs.
6. **Export & verwijdering**: gebruiker kan alle eigen gegevens downloaden en
   account + dossiers definitief verwijderen (met gedocumenteerde uitzonderingen
   voor betaaladministratie).
7. **DPIA-aanzet** in `docs/privacy.md`. Vermeld expliciet dat lancering
   juridische review vereist.

## Gemeente-registry

`MunicipalityConfig`-registry (database, admin-beheerbaar) voor de 19 Brusselse
gemeenten + parking.brussels, met per entry: naam, postcodes, taal/talen,
beheerder, indieningskanaal, vereiste documenten per aanvraagtype, tarieven en
geldigheidsduur, bijzonderheden, en verificatievelden (`verificationStatus`,
`sourceUrls[]`, `verifiedAt`, `verifiedBy`).

Regels:

1. **Onderzoeksfase eerst**: officiële bronnen (gemeentesites, parking.brussels),
   geen blogs. Leg per veld bron-URL en raadpleegdatum vast in
   `docs/gemeenten.md`. Wat niet te staven is: UNVERIFIED en leeg laten —
   **verzin nooit e-mailadressen, vereisten of tarieven**.
2. Verzending naar UNVERIFIED of STALE is technisch geblokkeerd; de UI toont
   "Deze gemeente wordt binnenkort ondersteund" en biedt het dossier als download.
3. `verifiedAt` ouder dan 6 maanden → automatisch STALE + admin-notificatie.

## Datamodel

`Dossier`, `DossierDocument`, `ExtractionResult`, `DossierStatusEvent`,
`Mandate`, `MunicipalityConfig`.

Statuslifecycle: DRAFT → DOCS_UPLOADED → EXTRACTED → NEEDS_USER_REVIEW →
READY_FOR_SUBMISSION → IN_ADMIN_REVIEW → SUBMITTED → AWAITING_MUNICIPALITY →
INFO_REQUESTED → APPROVED / REJECTED / CANCELLED

Indexes, unique constraints, cascades en timestamps zoals in een productieschema.

## Functionele flows

**1. Wizard (mobile-first, NL en FR).** Type kiezen → gemeente (auto-suggestie
via postcode) → vereiste documenten tonen → multi-file upload (camera + bestand,
JPG/PNG/PDF, max 10 MB, client-side compressie, previews, type-label) → extractie
→ **gebruiker controleert en corrigeert elk veld** (verplicht; confidence < 90
gemarkeerd) → volmacht + consents → betaling indien vereist → samenvatting →
indienen. Voor TEMPORARY_VEHICLE: begin- en einddatum verplicht, met een
tijdelijke verklaring-PDF.

**2. Extractie & validatie.** Vision-call per document met gestructureerde
JSON-output en per-veld confidence. Validatie: Belgisch kentekenformaat,
VIN-checkdigit, naam op ID vs. kentekenbewijs (fuzzy match), adres binnen de
gekozen gemeente, leesbaarheid. Bij falen of lage confidence: nooit stilzwijgend
doorgaan.

**3. Dossier-generatie.** Net PDF-dossier per gemeente: begeleidende brief
(NL/FR), gegevens, volmacht, bijlagen. Geen officiële gemeentelijke formulieren
nabouwen alsof ze van de gemeente komen.

**4. Verzending & opvolging.** Verzending vanaf een dedicated adres met
dossierreferentie in het onderwerp; volledige verzendlog. Inbound antwoorden
worden aan het dossier gekoppeld; statuswijziging door inbound mail vereist
admin-bevestiging. Gebruiker ziet een tijdlijn en krijgt e-mail bij elke
wijziging. Reminder-job bij > 10 werkdagen zonder antwoord.

**5. Betalingen & entitlements (server-side).** SINGLE_SERVICE €12,99 per
dossier; PRO-abonnement €8,99/maand met onbeperkt dossiers. Mollie-webhooks met
signature verification, idempotency en event log. Prijzen admin-configureerbaar.

**6. Admin.** Reviewqueue (dossier bekijken, documenten inzien met
access-logging, velden corrigeren, goedkeuren & verzenden, afwijzen met reden),
registry beheren, per-gemeente auto-send toggle (default uit), metrics.

## Fases

- **Fase 0** — Audit & onderzoek: repo-audit, `PLAN.md`, gemeente-onderzoek →
  `docs/gemeenten.md`, registry-seed, migrations.
- **Fase 1** — Upload & opslag: secure upload-pipeline, storage, retentie-job.
- **Fase 2** — Extractie & validatie: `DocumentExtractor` + adapter,
  validatieregels, correctie-UI, unit tests met synthetische fixtures.
- **Fase 3** — Wizard & dossier-generatie: 4 aanvraagtypes, volmacht/consents,
  PDF NL/FR.
- **Fase 4** — Verzending, opvolging & admin: mail out/in, statuslifecycle,
  reviewqueue, supervised mode, notificaties, reminder-job.
- **Fase 5** — Betalingen, privacy-afronding & launch: Mollie + entitlements,
  export/verwijdering, DPIA-aanzet, E2E-test, `LAUNCH_CHECKLIST.md`, README met
  LIVE / CONFIGURATION REQUIRED / NOT AVAILABLE-tabel.

## Definition of Done

Install, typecheck, lint, unit tests, integration tests en production build
slagen; de volledige dossier-lifecycle werkt aantoonbaar in een testomgeving;
supervised mode is afdwingbaar; verzending naar ongeverifieerde gemeenten is
geblokkeerd; retentie- en verwijderflows werken; Mollie-sandboxflow werkt; en
`INTEGRATIONS.md` vermeldt exact welke credentials nog ingevuld moeten worden.
Geen TODO's in kritieke flows, geen gemockte productie-integraties, geen
verzonnen gemeente-data.
