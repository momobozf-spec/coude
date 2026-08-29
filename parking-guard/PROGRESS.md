# Voortgang

Bijgewerkt: 2026-08-29
Dit bestand is geschreven om een verse sessie exact te laten verdergaan.

## Waar we staan

**Fase 0 is af.** `npm run verify` is groen: schemavalidatie → typecheck → lint →
16 unit tests → productiebuild. De applicatie draait, `/api/health` bevestigt de
database, en de startpagina toont de echte registry.

## Wat er staat

```
parking-guard/
├─ prisma/
│  ├─ schema.prisma          volledig datamodel, migration toegepast
│  ├─ migrations/            20260829011631_initial_schema
│  └─ seed.ts                19 gemeenten, idempotent, respecteert handmatige verificatie
├─ src/
│  ├─ app/
│  │  ├─ page.tsx            registry-overzicht, leest echte data
│  │  ├─ layout.tsx          mobile-first shell
│  │  └─ api/health/route.ts echte databasecheck
│  ├─ domain/municipality/
│  │  └─ submission-policy.ts   DE verzendblokkade — pure functie, 16 tests
│  ├─ server/municipalities.ts  leeslaag boven de registry
│  └─ lib/                   env.ts (Zod), logger.ts (pino + redaction), db.ts
├─ scripts/dev-db.ts         embedded PostgreSQL op poort 5434
├─ tests/unit/               submission-policy.test.ts
└─ docs/
   ├─ gemeenten.md           het onderzoek, met bron-URL per veld
   ├─ decisions/0001..0005   ADR's
   └─ module-bewonerskaart/  PLAN.md, BRIEF.md
```

## De belangrijkste bevinding tot nu toe

**Bij 18 van de 19 gemeenten kunnen wij niet namens de gebruiker indienen.**

- parking.brussels beheert 13 gemeenten en sloot zijn e-mailkanaal op 16-03-2026.
  Wat overblijft: e-loket (persoonlijke login) en post.
- Brussel-Stad vereist de eID mét pincode van de aanvrager, of een afspraak aan
  het loket. Een pincode is persoonlijk; dat kanaal hoort voor ons dicht te zijn.
- Alleen **Oudergem** publiceert een e-mailadres voor aanvragen
  (`mobilite@auderghem.brussels`) én aanvaardt uitdrukkelijk een volmacht.

Twee andere e-mailadressen die in zoekresultaten opdoken, bleken bij het
rechtstreeks nalezen van de officiële pagina **niet bevestigd** en zijn daarom
niet geseed. Zie `docs/gemeenten.md`.

Dit verandert niet wat we bouwen, maar wel wat we mogen beloven. Zie ADR 0005.

## Direct beginnen

```bash
cd parking-guard
npm install
cp .env.example .env          # vul AUTH_SECRET en STORAGE_ENCRYPTION_KEY
npm run dev:db                # laat draaien in een eigen terminal
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run verify` is de gate vóór elke commit.

Let op: poort 5434, niet 5433 — dat laatste is in gebruik door een buurproject in
deze werkruimte.

## Volgende stap: fase 1 — upload & opslag

1. `src/server/storage/`: `DocumentStore`-interface, `LocalDocumentStore`
   (AES-256-GCM naar `.storage/`) en `S3DocumentStore` (AWS SDK v3). ADR 0003.
2. Upload-route met Zod-validatie: JPG/PNG/PDF, max 10 MB, magic-byte-controle
   (niet alleen de meegestuurde mimetype vertrouwen).
3. Documenttoegang uitsluitend via een route die eerst autoriseert en dan een
   `DocumentAccessLog` schrijft. Ook voor admins.
4. Signed URLs met korte TTL (`STORAGE_SIGNED_URL_TTL_SECONDS`, default 300).
5. `src/jobs/`: `JobQueue`-interface + Postgres-driver (`FOR UPDATE SKIP LOCKED`)
   + worker. ADR 0002.
6. Retentie-job: documenten verwijderen `DOCUMENT_RETENTION_DAYS` na afronding,
   met auditlog van de verwijdering.
7. Integratietests tegen de echte database voor upload → bekijken → verwijderen.

**Exit-criterium:** documenten veilig uploaden, bekijken en verwijderen werkt
end-to-end, en de retentie-job ruimt aantoonbaar op.

## Openstaand voor de opdrachtgever

1. **Papieren post** (ADR 0005): versturen wij zelf, of krijgt de gebruiker een
   print-klaar dossier? Bepaalt het aanbod voor 13 gemeenten. Tot er een antwoord
   is, staat `weSendPost` uit en krijgt de gebruiker het dossier.
2. **Credentials** volgens `INTEGRATIONS.md`, in die volgorde. Nu nog niets nodig.
3. **Juridische review** van volmacht- en consentteksten vóór lancering.

## Schulden en bewuste keuzes

- Negen parking.brussels-gemeenten staan `UNVERIFIED`: beheerder en kanaal zijn
  bekend, tarieven en documentlijst niet individueel nagelezen. Blokkeert niets
  (hun kanaal is toch POST), maar voorkomt dat we een verkeerd bedrag tonen.
- `next-auth` staat op een beta. Bewust gepind; alles wat er echt van is, blijft
  achter onze eigen helpers. ADR 0004.
- De BullMQ-driver is nog niet geschreven (fase 1) en is pas bewezen zodra er
  ergens een Redis draait.
