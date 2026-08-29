# ADR 0002 — Achtergrondtaken: aparte always-on Node worker

- **Status:** aanvaard
- **Datum:** 2026-08-29

## Context

De detectiepijplijn moet op werkdagen betrouwbaar draaien, onafhankelijk van inkomend webverkeer.
De opdracht laat de keuze tussen **Supabase Cron + Edge Functions** en een **aparte always-on Node
worker**, mits gedocumenteerd.

De workload is niet triviaal:

- twee gescheiden fasen per rit (trip-resolutie 's ochtends, uitkomstmeting na aankomst) met
  herhaalpogingen tot maximaal 3 uur na de geplande aankomst;
- een client-side rate limiter die over álle iRail-calls van het proces heen moet gelden;
- gedeelde domeinlogica met de webapp: de iRail-client, de Zod-schema's, de compensatieberekening
  en de claimtemplates worden zowel door de worker als door de Next.js-app gebruikt.

## Beslissing

**Een aparte always-on Node-worker in dezelfde repository en hetzelfde TypeScript-project**, met een
in-process scheduler, gedeployed als tweede service naast de webapp.

Structuur:

- `src/worker/main.ts` — entrypoint, scheduler, graceful shutdown
- `src/lib/**` — gedeelde domeinlogica, geïmporteerd door zowel `src/app/**` als `src/worker/**`
- de worker draait met de **service-role**-sleutel van Supabase en omzeilt dus RLS bewust;
  daarom raakt hij uitsluitend server-side code en nooit iets dat aan een browser wordt geserveerd.

## Waarom niet Supabase Cron + Edge Functions

| Overweging | Gevolg |
|---|---|
| **Gedeelde code** | Edge Functions draaien op Deno met eigen imports. De compensatieberekening en iRail-parsing zouden gedupliceerd of via een apart pakket gedeeld moeten worden. Dupliceren van compensatielogica is onaanvaardbaar: dat is precies de code die niet mag afwijken tussen twee plaatsen. |
| **Rate limiting** | Onze fair-use-garantie (2 req/s, gedeelde token bucket) veronderstelt één langlevend proces. Bij Edge Functions is elke invocatie een eigen isolate zonder gedeelde state; de limiet zou alleen via een externe teller afdwingbaar zijn — meer complexiteit, meer faalkans, en een reëel risico op een IP-blokkade bij iRail. |
| **Uitvoeringsduur** | De uitkomstmeting kent wachtvensters en herpogingen tot 3 uur na de geplande aankomst. Dat past niet in één invocatie en zou opgeknipt moeten worden in veel kleine cron-slagen met eigen state-machine in de database. |
| **Testbaarheid** | De worker draait nu onder Vitest met dezelfde fixtures als de unit tests. Een Deno Edge Function zou een tweede testopstelling vereisen. |
| **Observability** | Eén Sentry-project, één logger, één healthcheck. |

Supabase Cron blijft wél in gebruik voor één ding waarvoor het uitstekend geschikt is: een
**dead-man's switch** die alarmeert als de worker langer dan 2 uur geen heartbeat heeft geschreven
(`worker_heartbeats`). De worker bewaakt de ritten; Supabase Cron bewaakt de worker.

## Gevolgen

- **Twee services in productie.** De webapp en de worker draaien apart; beide hebben hun eigen
  healthcheck. Dit staat in `README.md` en in de deploy-configuratie.
- **Kosten:** een always-on container in plaats van per-invocatie. Bewust aanvaard — een gemiste
  detectie kost de gebruiker een claimtermijn, en dat weegt zwaarder.
- **De scheduler is idempotent en herstartbaar.** Alle voortgang staat in de database
  (`monitored_trips.checked_at`, status), niet in het geheugen van het proces. Een herstart midden
  in een cyclus verliest niets en dupliceert niets — afgedwongen door de unique constraint
  `(route_id, service_date)` en door `claims(user_id, monitored_trip_id)`.
- **Bij horizontaal schalen** naar meerdere worker-instanties is een advisory lock per route nodig.
  Vandaag draait er bewust **één** instantie; dat is expliciet gedocumenteerd in de deploy-config
  zodat niemand het per ongeluk opschaalt en dubbele notificaties veroorzaakt.
