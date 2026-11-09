# Orbit — Architectuur

> Eén centrale plek voor ideeën, taken en notities. Android · iOS · Web.

## 1. Requirements-analyse (samenvatting)

| # | Requirement | Architecturale consequentie |
|---|---|---|
| 1 | Eén slim systeem i.p.v. drie losse apps | Eén generieke `Item`-basis met discriminated union op `type` (TASK / NOTE / IDEA). Conversie = type-wissel, geen data-migratie. |
| 2 | Quick capture overal | Losse `capture`-laag in `@orbit/core` met parser-pipeline; werkt zonder netwerk, schrijft in de outbox. |
| 3 | Offline-first | De client is de bron van waarheid tijdens gebruik; de server is de bron van waarheid bij sync. Delta-sync + outbox + per-veld conflictresolutie. |
| 4 | Realtime multi-device | Server-Sent Events change-stream per gebruiker; fallback = polling. Geen websocket-infra nodig. |
| 5 | 3 platformen, 1 codebase | Monorepo. Alle logica die geen DOM/native API nodig heeft zit in framework-agnostische packages. |
| 6 | Later AI toevoegen | Alle NLP/AI achter interfaces (`CaptureParser`, `Enricher`) met een lokale regelgebaseerde implementatie als default. |
| 7 | Commerciële SaaS | Workspace-scoping in élke query, audit log, rate limiting, input-validatie aan de rand, indexen op alle filterpaden. |

## 2. Kernbeslissing: het unified item-model

De grootste architecturale keuze. Drie alternatieven:

| Optie | Voordeel | Nadeel | Keuze |
|---|---|---|---|
| A. Drie aparte tabellen (Task/Note/Idea) | Strak schema per type | Conversie = kopiëren + verwijderen, verliest id/relaties/history. Search/tags/inbox drie keer bouwen. | Nee |
| B. Eén tabel, alle velden nullable | Conversie triviaal | Schema wordt een moeras, geen type-veiligheid | Nee |
| C. Eén `Item`-tabel met gedeelde kern + 1:1 type-extensies (`TaskDetail`, `NoteDetail`, `IdeaDetail`) | Conversie = detail toevoegen/verwijderen, id blijft. Tags/search/inbox/attachments/activity één keer. Type-veiligheid via Zod discriminated union. | Eén extra join per detail | **Ja** |

**Gekozen: C.** Hiermee is "idee wordt taak" een `UPDATE items SET type='TASK'` plus een insert in `task_details` — permalinks, backlinks, tags, bijlagen en activity blijven intact. Precies wat requirement 1 vraagt.

## 3. Technology decisions (met motivatie)

| Laag | Keuze | Waarom niet het alternatief |
|---|---|---|
| Monorepo | npm workspaces | pnpm/turbo geven snellere CI, maar npm workspaces zit in de standaard toolchain en de Expo/Metro-monorepo-support is hiermee het minst broos. Turborepo kan er later bovenop. |
| Taal | TypeScript strict overal | Gedeelde types zijn de hele waarde van de monorepo. |
| Web | Next.js (App Router) | Server components voor een snelle first paint van het dashboard; route handlers geven ons meteen de API zonder tweede deployment. |
| Mobile | Expo + React Native + NativeWind | EAS build en OTA-updates; NativeWind laat ons dezelfde Tailwind-tokens gebruiken als op web. |
| Backend | Next.js route handlers (Node runtime) in `apps/web` | *Niet* Supabase: onze sync-engine heeft server-gecontroleerde logische klokken, tombstones en per-veld conflictresolutie nodig — dat hoort in applicatiecode, niet in RLS-policies. *Niet* een losse NestJS-service: dat is een tweede deployment, CI-pijplijn en auth-context voor nul extra functionaliteit op deze schaal. De use-case-laag zit in `packages/api-core` en is framework-agnostisch, dus verhuizen naar NestJS/Fastify is later een kwestie van een andere adapter. |
| DB | PostgreSQL + Prisma | Relationeel model met veel joins, `tsvector` full-text search en JSONB voor rich text. Prisma geeft typed queries die aansluiten op de gedeelde types. |
| Validatie | Zod aan elke rand (API in, API uit, forms, sync-payloads) | Eén schema, afgeleide types, runtime-veiligheid. |
| Data-fetching | TanStack Query + persistente cache | Optimistic updates, retry en invalidatie; onze sync-engine voedt dezelfde cache. |
| Auth | Eigen sessies (Argon2id + roterende refresh tokens) + OAuth (Google/Apple/Microsoft) | Geen vendor lock-in op de identiteitslaag; mobiel heeft langlevende refresh tokens nodig die we zelf willen kunnen intrekken. |
| Realtime | SSE | Eenrichtingsverkeer server naar client is genoeg (de client pusht via REST). Werkt door proxies heen, geen sticky sessions. |
| Styling | Tailwind (web) + NativeWind (mobile) op gedeelde design tokens | De tokens in `@orbit/ui/tokens` zijn de single source of truth; beide platforms genereren daar hun thema uit. |

## 4. Package-verantwoordelijkheden

```
packages/
  types/        Pure TS: domein-types, enums, constants. Nul dependencies.
  validation/   Zod-schemas voor elk type plus de API-contracten.
  utils/        Datum/tijd, id-generatie (ULID), Result, invariant, deep-equal.
  core/         ALLE businesslogica, framework-agnostisch en volledig testbaar:
                  - recurrence engine (RRULE-subset)
                  - quick-capture parser (NL/EN natural language)
                  - item-conversie (idee wordt taak wordt project)
                  - views/selectors (Vandaag, Achterstallig, Komend, ...)
                  - sync engine (outbox, delta-pull, conflictresolutie)
                  - zoekindex en filters
  db/           Prisma schema, client-singleton, workspace-scoped repositories.
  auth/         Wachtwoord-hashing, tokens, sessies, OAuth-providers, guards.
  api-core/     Use-cases: pure functies (ctx, input) naar output. De HTTP-laag
                is een dunne adapter hierop. Maakt de API portable.
  api-client/   Typed client + TanStack Query hooks. Gedeeld door web en mobile.
  ui/           Design tokens, thema's en cross-platform primitives.
apps/
  web/          Next.js: UI plus /api route handlers (adapter over api-core).
  mobile/       Expo: UI plus native laag (notificaties, SQLite, secure storage).
```

**Afhankelijkheidsregel (eenrichtingsverkeer):**

`types` → `validation` → `utils` → `core` → `api-core` → `db` / `auth` → `apps`.
`api-client` hangt alleen af van `validation` en `types`. `ui` alleen van `types`.
`core` mag *nooit* `db`, `next`, `react-native` of `react` importeren — dat wordt door een lint-regel afgedwongen.

## 5. Sync-architectuur (offline-first)

### Model

Elke muteerbare rij heeft:

- `id` — ULID, **client-generated**, zodat je offline meteen relaties kunt leggen.
- `updatedAt` — server-timestamp.
- `serverSeq` — monotone `bigint` per workspace (logische klok uit een Postgres-sequence).
- `deletedAt` — soft delete (tombstone), nooit hard delete binnen de retentieperiode.
- `revision` — teller voor optimistic concurrency.

### Push (client naar server)

1. Elke mutatie gaat lokaal direct in de store (optimistic) én in de `outbox`.
2. Outbox-entries zijn *operaties* (`create` / `patch` / `delete` met alleen de gewijzigde velden en een `clientTs`), geen hele objecten. Per-veld patches maken conflictresolutie fijnmazig.
3. Een achtergrond-worker stuurt batches naar `POST /api/sync/push`. Idempotent via `operationId` (ULID); de server houdt verwerkte ids bij.

### Pull (server naar client)

`GET /api/sync/pull?since=<serverSeq>` levert alle rijen met `serverSeq > since`, gepagineerd. De client bewaart de hoogste `serverSeq` als cursor.

### Conflictresolutie

Per veld, deterministisch:

1. Heeft de server het veld gewijzigd ná de `clientTs` van de operatie? Dan wint de server; het veld gaat terug in de push-response en de client past het toe.
2. Anders wint de client.
3. `completedAt` en checklist-vinkjes zijn **monotone merges**: afgevinkt wint van niet-afgevinkt binnen hetzelfde tijdvenster. Dit is de enige afwijking van last-write-wins, omdat "taak staat plots weer open" de vervelendste UX-fout is.
4. De rich-text `content` van notities is een blok-array; blokken mergen per blok-id.

Conflicten worden gelogd in `Activity`, zodat "wat is er met mijn notitie gebeurd" beantwoordbaar blijft.

### Realtime

Na een geslaagde push publiceert de server een change-event op het SSE-kanaal van de gebruiker (`/api/sync/stream`). Andere devices doen dan meteen een incrementele pull. Fallback: pullen elke 60 seconden en bij app-foreground.

## 6. Security

- Alle API-input door Zod; alles wat niet in het schema staat wordt gestript.
- **Workspace-scoping wordt afgedwongen in de repository-laag**, niet in route handlers — het is onmogelijk om een query te schrijven zonder `workspaceId`.
- Argon2id voor wachtwoorden; refresh-token-rotatie met hergebruikdetectie (hergebruik betekent de hele token-familie intrekken).
- Rate limiting per IP en per gebruiker op de auth-, sync- en zoek-endpoints (token bucket).
- Uploads via presigned URLs, MIME-sniffing aan serverkant, maximale grootte, hook voor virusscanning.
- Audit log (`Activity`) voor create/update/delete/login/export.
- Secrets uitsluitend via env; `packages/env` valideert ze bij boot met Zod (fail fast).

## 7. Performance

- Composite indexen op precies de queries van de views (zie DATA-MODEL.md).
- Cursor-based pagination overal (`serverSeq` of `(sortKey, id)`).
- Optimistic updates plus een persistente query-cache, zodat het dashboard offline direct rendert.
- Notitie-content lazy: lijstweergaven laden `preview` (eerste 200 tekens), niet de blokken.
- Full-text search via een Postgres `tsvector` GIN-index; lokaal via een in-memory inverted index in `@orbit/core`.
