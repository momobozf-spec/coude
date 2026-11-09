# Orbit — Implementatieroadmap

Na elke fase: `npm run typecheck`, `npm run lint`, `npm test`, fouten oplossen, rapporteren, door naar de volgende fase.

| Fase | Inhoud | Status |
|---|---|---|
| 1 | Projectsetup en architectuur: monorepo, tsconfig, eslint, vitest, `types`, `validation`, `utils`, design tokens | ✅ |
| 2 | Database en authenticatie: Prisma-schema, migraties, repositories, Argon2id, sessies met token-rotatie, OAuth-adapters, rate limiting | ✅ |
| 3 | App shell en navigatie: web sidebar-layout, mobiele tabbar, thema's, command palette | ✅ |
| 4 | Taken: CRUD, views (Vandaag/Morgen/Week/Komend/Alles/Voltooid), prioriteiten, subtaken, checklists, recurrence | ✅ |
| 5 | Notities: blokgebaseerde editor, autosave, folders, rich text, backlinks | ⬜ |
| 6 | Ideeën: idea inbox, statusflow, verrijking, conversie naar taak/project | ◐ conversie werkt al |
| 7 | Projecten: projectdetail met taken/notities/ideeën, voortgang | ◐ model en voortgang werken al |
| 8 | Tags en search: centraal tagsysteem, globale zoekfunctie met filters | ◐ tags werken al |
| 9 | Kalender en reminders: dag/week/maand, scheduler, push- en lokale notificaties | ⬜ |
| 10 | Offline sync: outbox, delta-pull, conflictresolutie, SSE-stream | ◐ schema en klok liggen klaar |
| 11 | Mobile polish: swipes, haptics, widgets, share-extensie | ⬜ |
| 12 | Web polish: keyboard shortcuts, drag & drop, bulk actions, undo | ◐ shortcuts en palet werken |
| 13 | Testing en security hardening: e2e-flows, pentest-checklist, headers, CSP | ◐ 137 unit + 19 integratie + 29 e2e |
| 14 | Production deployment: Docker, migraties, monitoring, backups | ⬜ |

## Wat er per afgeronde fase staat

### Fase 1 — fundering

npm workspaces, gedeelde `tsconfig.base.json`, ESLint met de afhankelijkheidsregel uit ARCHITECTURE.md §4.
`@orbit/types` (domein en enums), `@orbit/validation` (Zod), `@orbit/utils` (ULID, tijdzones, fractional indexing),
`@orbit/ui` (design tokens, licht en donker), `@orbit/core` (recurrence-engine en quick-capture-parser).

### Fase 2 — database en authenticatie

Prisma-schema met 18 tabellen, migratie toegepast, plus `001_sync_infrastructure.sql` voor de dingen die Prisma niet
uitdrukt: de `orbit_server_seq`-sequence, triggers die de logische klok bijwerken (ook op het bovenliggende item bij
een detailwijziging), `tsvector`-kolommen met GIN-index, trigram-index en partiële indexen.
`@orbit/db` met workspace-scoping in de repository-laag. `@orbit/auth` met Argon2id, roterende refresh tokens met
hergebruikdetectie, OAuth-adapters voor Google, Apple en Microsoft, en een token-bucket rate limiter.

Zonder Docker of systeem-PostgreSQL: `packages/db/scripts/local-db.mjs` start een embedded PostgreSQL op poort 5442.

### Fase 3 — app shell

Web: sidebar met tellers en projecten, commandopalet (Cmd+K), sneltoetsen (`g`-reeks, `n`, `/`),
licht/donker/systeem zonder flits, quick capture met live chips.
Mobiel: Expo Router met de tabbar Home | Taken | + | Notities | Meer, sessie in SecureStore,
dezelfde design tokens als op web.

### Fase 4 — taken

`@orbit/core`: `viewToFilter`, `matchesFilter` (dezelfde semantiek als de SQL), sorteren en groeperen,
`planTaskCompletion` (herhalende taken schuiven door in plaats van te sluiten), `planConversion`.
`@orbit/db`: itemrepository met `filterToWhere`, subtaak- en checklisttellingen zonder N+1.
`@orbit/api-core`: use-cases voor lijsten, dashboard, quick capture, afvinken, conversie en bulk.
API-routes met validatie, rate limiting en uniforme foutvorm. Web-UI met optimistisch afvinken en inbox-triage.

## Volgende fase

**Fase 5 — Notities.** De blokgebaseerde editor met autosave, folders en backlinks. Het datamodel, de merge per blok
en de conversie staan er al; wat ontbreekt is de editor zelf.
