# ADR 0002 — Achtergrondtaken: driver-interface, Postgres standaard, BullMQ op `REDIS_URL`

Datum: 2026-08-29
Status: aanvaard

## Context

De brief vraagt "Redis + BullMQ voor achtergrondtaken, aparte worker". Op de
ontwikkelmachine draait geen Redis en geen Docker (`docker --version` en
`psql --version` geven beide niets).

Dat is niet zomaar een ongemak. Drie dingen in de Definition of Done hangen aan
achtergrondtaken:

- de retentie-job die brondocumenten X dagen na afronding verwijdert
- de reminder-job bij dossiers die >10 werkdagen op de gemeente wachten
- de extractie-queue (vision-calls horen niet in een request-cyclus)

Met een BullMQ-only opzet zou geen van die drie aantoonbaar werken zonder eerst
infrastructuur te regelen. Werkregel 1 zegt: alles wat de UI als werkend toont,
werkt echt. Een queue die alleen op papier bestaat, is precies wat daar verboden
wordt.

Tegelijk is de vraag naar BullMQ legitiem: in productie op Render of vergelijkbaar
is Redis triviaal beschikbaar, en BullMQ geeft retries, backoff, delayed jobs en
een inspecteerbare queue die je niet zelf wilt schrijven.

## Beslissing

Eén `JobQueue`-interface met **twee echte implementaties**:

```
src/jobs/queue/
  types.ts            de interface + het Job-contract
  postgres-queue.ts   SELECT … FOR UPDATE SKIP LOCKED op een jobs-tabel
  bullmq-queue.ts     BullMQ + ioredis
  index.ts            kiest op basis van REDIS_URL
```

`REDIS_URL` leeg of afwezig → Postgres-driver. `REDIS_URL` gezet → BullMQ-driver.
De keuze valt één keer bij het opstarten en wordt gelogd, zodat er nooit twijfel
is welke driver draait.

De aparte worker (`npm run worker`, `src/jobs/worker.ts`) bestaat in beide
gevallen en is hetzelfde proces met dezelfde handlers. Alleen de transportlaag
verschilt.

De Postgres-driver is geen speelgoedversie. Hij doet wat de jobs hier nodig
hebben: at-least-once levering, `SKIP LOCKED` zodat meerdere workers elkaar niet
blokkeren, exponentiële backoff, een maximum aantal pogingen, `runAt` voor
uitgestelde en periodieke jobs, en een dead-letter-status. Dat is genoeg voor een
retentie-job en een reminder-job; het is geen vervanging voor BullMQ bij
duizenden jobs per seconde, en dat hoeft ook niet.

## Waarom niet gewoon BullMQ met een in-memory Redis-mock

Omdat dat een mock is in een productieflow. De retentie-job verwijdert
identiteitsdocumenten; die wil je getest hebben tegen dezelfde machinerie die het
in productie doet, niet tegen een nabootsing. Een tweede echte driver is meer
werk dan een mock en aanzienlijk minder werk dan het vertrouwen dat je verliest
als de verwijdering in productie stil faalt.

## Gevolgen

- Alle achtergrondtaken werken lokaal en in CI zonder extra infrastructuur.
- De BullMQ-driver staat in `INTEGRATIONS.md` als `CONFIGURATION REQUIRED`: hij
  is volledig geschreven, maar pas actief als `REDIS_URL` gezet is en is dus niet
  in productie bewezen tot dat gebeurt. Dat staat er ook zo.
- De jobs-tabel komt in het Prisma-schema en dus in de migrations.
- Handlers mogen niets driver-specifieks aannemen. Dat wordt afgedwongen doordat
  ze alleen de interface uit `types.ts` zien.
