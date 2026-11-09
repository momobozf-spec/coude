# Orbit

Eén centrale plek voor **ideeën, taken en notities** — op Android, iOS en web, vanuit één codebase.

Geen drie losse apps onder één dak: alles is één itemmodel, waardoor een idee met één klik een taak wordt en een notitie een checklist, zonder dat links, tags of geschiedenis verloren gaan.

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Requirements-analyse, technology decisions met motivatie, sync-architectuur, security |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Alle tabellen, relaties en indexen |
| [docs/ROADMAP.md](docs/ROADMAP.md) | De veertien fases en wat er per fase af is |

## Structuur

```
apps/
  web/         Next.js: webinterface en de REST-API
  mobile/      Expo: iOS en Android
packages/
  types/       Domeintypes en enums (geen dependencies)
  validation/  Zod-schemas en API-contracten
  utils/       ULID, datums met tijdzones, fractional indexing, Result
  core/        Businesslogica: recurrence, quick capture, views, conversie
  ui/          Design tokens en thema's
  db/          Prisma-schema en workspace-scoped repositories
  auth/        Argon2id, tokenrotatie, OAuth, rate limiting
  api-core/    Use-cases; de HTTP-laag is er maar een dunne adapter overheen
  api-client/  Typed client, gedeeld door web en mobiel
```

De afhankelijkheden lopen één kant op en `core` blijft framework-vrij — een ESLint-regel bewaakt dat.

## Aan de slag

```bash
npm install

# Database. Zonder Docker of systeem-PostgreSQL start dit een embedded
# PostgreSQL op poort 5442 met een datadirectory in packages/db/.pgdata:
npm run db:local              # laten draaien in een aparte terminal

# In een tweede terminal: schema, sync-infrastructuur en demodata
npm run local:setup --workspace @orbit/db

# Configuratie
cp .env.example .env
#   DATABASE_URL="postgresql://orbit:orbit@localhost:5442/orbit?schema=public"
#   AUTH_SECRET met: openssl rand -base64 48

npm run dev:web               # http://localhost:3000
npm run dev:mobile            # Expo
```

Heb je wél Docker, dan kan `docker compose up -d postgres` in plaats van de embedded database; pas dan de poort in `DATABASE_URL` aan naar 5432.

De seed maakt een demo-account: `demo@orbit.app` / `demo-wachtwoord-2026`, met projecten, taken, notities en ideeën.

## Scripts

| Commando | Doel |
|---|---|
| `npm run verify` | typecheck (packages, web, mobile) + lint + unittests |
| `npm test` | Vitest, zonder database |
| `npm run test:integration` | Integratietests tegen een echte PostgreSQL (start er zelf een op poort 5443) |
| `npm run db:local` | Embedded PostgreSQL voor ontwikkeling |
| `npm run local:setup --workspace @orbit/db` | Migreren, sync-SQL toepassen en seeden |
| `npm run db:studio --workspace @orbit/db` | Prisma Studio |

### End-to-end rooktest

```bash
npm run build:web
node apps/web/scripts/serve-local.mjs 3100      # terminal 1
node apps/web/scripts/smoke.mjs http://localhost:3100   # terminal 2
```

Loopt registratie, validatie, quick capture, een herhalende taak, de weergaven, conversie en de auth-grenzen door over echte HTTP.

## Waarom bepaalde keuzes

**Eén `Item`-tabel met type-extensies** in plaats van drie aparte tabellen. Conversie tussen idee, taak en notitie is dan een typewissel in plaats van kopiëren-en-verwijderen, en zoeken, tags, bijlagen en de inbox hoeven maar één keer gebouwd te worden.

**Eigen API in Next.js** in plaats van Supabase. De sync-engine heeft server-gecontroleerde logische klokken, tombstones en conflictresolutie per veld nodig; dat hoort in applicatiecode, niet in RLS-policies. De use-cases zitten in `@orbit/api-core` en zijn framework-vrij, dus verhuizen kan later met een andere adapter.

**Client-generated ULIDs.** Offline een taak aanmaken en er meteen een tag aan hangen kan alleen als de client zelf ids mag bepalen. ULIDs sorteren bovendien op aanmaaktijd.

**Herhalende taken schuiven door** in plaats van dat er per voorkomen een nieuwe rij ontstaat. De taak houdt zijn id, dus links en bijlagen blijven kloppen, en een dagelijkse taak levert geen 365 rijen per jaar op. De losse voorkomens staan in het activiteitenlog.

**Design tokens in plaats van NativeWind.** De tokens in `@orbit/ui` zijn wat web en mobiel echt delen: web leest ze als CSS-variabelen, React Native als gewone objecten. NativeWind zou daar een tweede vertaalslag met eigen babel- en metro-stap bovenop leggen terwijl de winst alleen in schrijfstijl zit.

Meer daarover in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
