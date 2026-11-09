# Parking Guard Brussel

Een consumentenplatform voor Brusselaars, met drie pijlers:

1. **Live Alerts** — crowdsourced scanauto-notificaties *(nog niet gebouwd)*
2. **Boete aanvechten** — automatisch bezwaarschrift *(nog niet gebouwd)*
3. **Bewonerskaart** — aanvragen, verlengen of wijzigen **(in aanbouw, fase 0 af)**

Deze repository bevat module 3. De andere twee hebben een gereserveerde plek in
`src/domain/`, zodat ze later landen zonder verbouwing.

## Wat het doet

Een bewonerskaart aanvragen of wijzigen bij een Brusselse gemeente vraagt om
documenten, formulieren en termijnen. Wij maken daar een mobiele wizard van:
documenten fotograferen, de gegevens laten uitlezen, ze zelf controleren, en een
compleet dossier laten samenstellen — met statusopvolging in een dashboard.

## Wat het eerlijk gezegd níét doet

**Bij 18 van de 19 Brusselse gemeenten kunnen wij het dossier niet namens jou
indienen.** Dat ligt niet aan ons:

- **parking.brussels** beheert de kaarten voor 13 gemeenten en heeft zijn
  e-mailkanaal op **16 maart 2026** afgesloten. Wat overblijft is het e-loket
  (met persoonlijke login) en de post.
- **Brussel-Stad** vraagt je eigen elektronische identiteitskaart mét pincode, of
  een afspraak aan het loket. Een pincode is persoonlijk — dat kanaal hoort voor
  een dienstverlener dicht te zijn, en dat is het hier ook.
- **Oudergem** is vandaag de enige gemeente met een gepubliceerd e-mailadres voor
  aanvragen die bovendien uitdrukkelijk een volmacht aanvaardt.

Voor alle andere gemeenten is het aanbod: wij verzamelen je documenten, lezen ze
uit, controleren ze op fouten en leveren een compleet dossier — en jij dient het
in. Dat is nog steeds het grootste deel van het werk, maar het is niet "wij
regelen het", en zo staat het nergens.

Details en bronnen: [`docs/gemeenten.md`](docs/gemeenten.md) en
[ADR 0005](docs/decisions/0005-indieningskanalen-en-de-grens-van-automatisering.md).

## Status per onderdeel

| Onderdeel | Status |
|---|---|
| Gemeente-registry (19 gemeenten, geverifieerd) | **LIVE** |
| Verzendblokkade bij ongeverifieerde gemeenten | **LIVE** |
| Datamodel + migrations | **LIVE** |
| Healthcheck `/api/health` | **LIVE** |
| Documentopslag (S3/R2) | CONFIGURATION REQUIRED |
| Vision/OCR-extractie | CONFIGURATION REQUIRED |
| E-mail uit en in | CONFIGURATION REQUIRED |
| Betalingen (Mollie) | CONFIGURATION REQUIRED |
| Wizard, dossier-PDF, admin | nog te bouwen (fase 2–5) |
| Pijler 1 en 2 | NOT AVAILABLE |

Volledige tabel met wat er precies nodig is: [`INTEGRATIONS.md`](INTEGRATIONS.md).

## Aan de slag

Vereist: Node 20+. Geen Docker nodig.

```bash
npm install
cp .env.example .env
# genereer twee secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# zet die in AUTH_SECRET en STORAGE_ENCRYPTION_KEY

npm run dev:db      # echte PostgreSQL op poort 5434, laat draaien
npm run db:migrate  # in een tweede terminal
npm run db:seed
npm run dev
```

Poort 5434 is bewust gekozen: 5432 is de standaardpoort van een lokaal
geïnstalleerde PostgreSQL, en 5433 is in gebruik door een buurproject in deze
werkruimte.

## Commando's

| Commando | Doet |
|---|---|
| `npm run verify` | De gate: validate → typecheck → lint → tests → build |
| `npm run dev` | Ontwikkelserver |
| `npm run dev:db` | Lokale PostgreSQL (embedded, geen Docker) |
| `npm run db:migrate` | Migrations toepassen |
| `npm run db:seed` | Gemeente-registry seeden |
| `npm test` | Unit tests |
| `npm run test:integration` | Integratietests (vereist een draaiende database) |
| `npm run worker` | Achtergrondworker |

## Architectuur in het kort

- **Next.js 16** App Router, TypeScript strict, Tailwind 4, mobile-first
- **PostgreSQL + Prisma 6**, echte migrations
- **`src/domain/`** is de rekenlaag: pure functies, geen database, geen netwerk.
  ESLint dwingt dat af. De vraag "mag dit dossier de deur uit" hoort daar, zodat
  het antwoord bewijsbaar is.
- **`src/server/`** praat met de database en de buitenwereld.
- **Achtergrondtaken** via een `JobQueue`-interface: Postgres standaard, BullMQ
  zodra `REDIS_URL` gezet is ([ADR 0002](docs/decisions/0002-jobs-postgres-driver-met-bullmq-optie.md)).
- **Documentopslag** via een `DocumentStore`-interface: S3 in productie, een
  encrypted lokale driver voor ontwikkeling ([ADR 0003](docs/decisions/0003-documentopslag-twee-drivers.md)).

## Privacy

Dit product verwerkt identiteitskaarten en kentekenbewijzen. Documenten staan
nooit in de database en nooit in git; alleen een opslagsleutel. Elk
documentbezoek wordt gelogd, ook dat van beheerders. De logger redigeert
gevoelige velden centraal, niet op de call-sites.

`docs/privacy.md` met de DPIA-aanzet volgt in fase 5. **Lancering vereist
juridische review**, onder meer van de volmacht- en consentteksten.

## Documentatie

- [`docs/module-bewonerskaart/PLAN.md`](docs/module-bewonerskaart/PLAN.md) — audit en plan
- [`docs/gemeenten.md`](docs/gemeenten.md) — het gemeente-onderzoek met bronnen
- [`docs/decisions/`](docs/decisions/) — ADR's
- [`PROGRESS.md`](PROGRESS.md) — waar we staan, wat de volgende stap is
- [`INTEGRATIONS.md`](INTEGRATIONS.md) — wat er nog aan credentials nodig is
