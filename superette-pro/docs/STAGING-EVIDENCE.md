# Staging-bewijs — validatie van de deploymentarchitectuur

Datum: **5 oktober 2026**. Doel: de productiearchitectuur aantonen in een
staging-achtige omgeving en elk technisch NO-GO-punt uit
`PRODUCTION-READINESS.md` § 18 sluiten dat door engineering te sluiten is.
Niets is gecommit, gepusht of naar productie gedeployd.

## De omgeving (wat "staging" hier betekent)

Op deze machine ontbreken Docker, WSL en een beheerde PostgreSQL-dienst. De
staging-opstelling is daarom een lokale stack **buiten OneDrive** die dezelfde
onderdelen, dezelfde configuratie en dezelfde paden gebruikt als productie:

| Onderdeel | Staging | Productie (doel) | Verschil |
|---|---|---|---|
| Broncode | kopie van de repository zonder `.env`, eigen `npm ci` | git-checkout in de Docker build-stage | geen |
| Builds | `tsc` (API), `next build` met `output: standalone` en `NEXT_PUBLIC_API_URL=https://…` | identiek (Dockerfile build-stage) | geen |
| API | `node dist/main.js`, `NODE_ENV=production`, JSON-logs, `TRUST_PROXY=1`, runtime-gebruiker | identiek in de container | geen container-isolatie, geen tini |
| Werker | 2 × `node dist/compare/cli/worker.cli.js`, interval 1 min | 1 × in de container | geen |
| App | `node .next/standalone/apps/superette-web/server.js` (zoals `CMD` in de Dockerfile) | identiek | geen |
| Database | PostgreSQL 18.4 (embedded binaries), **TLS aan**, eigenaar `superette` voor migraties, runtime-rol `superette_app` (DML, geen DDL), `sslmode=require` | beheerde PostgreSQL 16/17 met TLS | geen provider-back-ups/PITR; zelfondertekend certificaat |
| Reverse proxy | `scripts/staging-proxy.mjs`: HTTPS op 8443, `/api` → API, rest → app, `X-Forwarded-*`, bodylimiet | Caddy/nginx/provider | zelfondertekend certificaat, geen HTTP→HTTPS-redirect |
| Foutmonitoring | `ERROR_REPORTING_DSN` naar een lokale envelope-ontvanger (`monitor-sink.mjs`) | Sentry/GlitchTip/Bugsink | geen echte provider (geen account) |
| E-mail | `EMAIL_PROVIDER=file` (outbox) | `http` met geverifieerde afzender | geen echte provider |
| Gegevens | zeven importbestanden uit `apps/api/scripts/make-staging-feeds.ts`, `source.kind = DEMO`, `termsReviewed = false` | toegestane feeds per keten | staging toont overal DEMO; productie toont zonder feeds `UNAVAILABLE` |
| Containers | **niet gebouwd** (geen Docker) | Docker-images | zie § Containers |

Alle controles hieronder zijn uitgevoerd tegen `https://localhost:8443` door de
proxy heen, tenzij anders vermeld. Scripts: `smoke:auth`, `smoke:compare`,
`smoke:lease`, `walkthrough:superette`, `loadtest`, `db:migrate:test`,
`backup-drill.sh`, `ci-local.mjs` en de staging-shellscripts in de werkmap van
deze sessie.

## 1. CI-workflow, lokaal uitgevoerd (`npm run ci:local`)

GitHub Actions kan niet draaien zonder push (niet toegestaan) en de map
`superette/` is in de repository nog untracked. Daarom zijn alle `run:`-stappen
van `.github/workflows/superette-ci.yml` lokaal uitgevoerd met dezelfde
omgeving, in de staging-kopie, tegen de TLS-database (`superette_ci`). Twee
workflow-fouten kwamen daarbij aan het licht en zijn hersteld vóór de eerste
echte run: `${{ env.* }}` is op jobniveau niet beschikbaar (nu letterlijke
waarden) en de migratie-job zette geen wegwerpsleutels, waardoor de seed-CLI
op de env-validatie faalde. Daarnaast was het root-script
`npm run --workspace … exec` ongeldig voor npm 11 (nu `npm exec --workspace`).

| Job | Stap | Resultaat | Bewijs |
|---|---|---|---|
| check | `npm ci` (lockfile) | PASS, 68,6 s | 10 kwetsbaarheden gemeld incl. devDependencies (3 moderate, 7 high); productie-audit hieronder |
| check | Prisma-client, packages | PASS | – |
| check | typecheck (web, api, contracts, pricing) | PASS, 0 fouten | 20,8 s |
| check | unit-tests | PASS **259/259** | vat 13 · pricing 61 · api 162 · web 23 |
| check | API bouwen | PASS | `dist/main.js` |
| check | app bouwen, `output: standalone`, https-API-URL | PASS | `.next/standalone/apps/superette-web/server.js` aanwezig (buiten OneDrive lukt de trace) |
| check | bundelcontrole | PASS | 39 bestanden, geen geheimen/tokens/sourcemaps |
| check | boetiek-PWA bouwen (regressie) | PASS | `✓ Compiled successfully` |
| migrations | migratietest (drift, leeg, boetiekdata, rollback) | PASS **19/19** | 178 s; seed-CLI exit 0 |
| smoke | migreren + vullen, API starten | PASS | – |
| smoke | `smoke:compare`, `smoke:auth`, `smoke:lease`, logcontrole, loadtest | zie § 1a | – |
| smoke | werker SIGTERM-stap | SKIPPED (alleen Linux) | `if: runner.os == 'Linux'`; Windows kent geen SIGTERM-afhandeling |
| accessibility | bouwen, migreren, API + app starten | PASS | – |
| accessibility | doorloop met axe-core | PASS **206/206**, axe 0 overtredingen | 33 s |
| security | gitleaks | SKIPPED (`uses:`-stap; geen lokale gitleaks) | alleen in GitHub Actions |
| security | `npm audit --omit=dev --audit-level=critical` | PASS | 0 critical |
| security | `npm audit --omit=dev --audit-level=high` (rapport) | FAIL toegestaan | 3 high: `prisma → @prisma/config → deepmerge-ts`; enige fix = downgrade naar prisma 6.12; CLI-pad, geaccepteerd (`SECURITY.md`) |
| containers | docker build/run | **BLOCKED** | `docker: command not found`; geen Docker/WSL op deze machine |

### 1a. Smoke-job (herhaald na twee fixes)

Eerste herhaling: `smoke:auth` 88/94 — de twee gelijktijdige syncs kregen
`429` omdat `smoke:compare` vlak ervoor al 2 van de 5 sync-aanroepen per
minuut had verbruikt (7 > 5). Oplossing in de workflow: één minuut wachten
tussen beide rooktests (de limieten zijn per IP per minuut; CI deelt één IP).

| Stap | Resultaat | Bewijs |
|---|---|---|
| migreren + vullen (demogegevens), API starten (`NODE_ENV=test`) | PASS | `/health/ready` 200 na 3 s |
| `smoke:compare` | PASS **104/104** | 10,7 s |
| `smoke:auth` | PASS **94/94** | 73,5 s incl. wachttijd; alleen de Secure-vlag overgeslagen (http) |
| `smoke:lease` | PASS **13/13** | 11 s |
| logs zonder sleutel/wachtwoord/`"password":` | PASS | grep op `/tmp/api.log` |
| belastingstest (10 gebruikers, 15 s, één IP) | PASS (signaal) | 242 verzoeken, 0 fouten, 82 × 429 (zoeklimiet per IP, verwacht met één IP) |

Alle vereiste lokale poorten zijn daarmee groen. Niet uitvoerbaar op deze
machine: `containers` (geen Docker) en de werker-SIGTERM-stap (alleen Linux);
`gitleaks` draait alleen in GitHub Actions.

## 2. Containers (Docker-equivalent zonder Docker)

Docker ontbreekt op deze machine; de CI-job `containers` is dus **BLOCKED**.
Om de Dockerfiles toch inhoudelijk te toetsen zijn de stages met de hand
nagebouwd in aparte mappen buiten OneDrive:

| Stage uit `apps/api/Dockerfile` | Nagebouwd | Resultaat |
|---|---|---|
| build: `npm ci --ignore-scripts`, `prisma generate`, builds vat/pricing/contracts/api | staging-kopie | PASS (zie CI `check`) |
| build: `next build` met `output: standalone` | staging-kopie | PASS: `.next/standalone/apps/superette-web/server.js` aanwezig; de app draait eruit op 3001 (`CMD` uit `apps/superette-web/Dockerfile`) |
| prod-deps: alleen package-manifesten (8) + `npm ci --omit=dev --ignore-scripts` | `runtime-image/` | PASS: `vitest` en `@nestjs/cli` afwezig; `node_modules` 582 MB (incl. Prisma-engines en Next uit de root-workspace); `typescript` blijft aanwezig via een productie-afhankelijkheid |
| runtime: `COPY` van `dist`, `.prisma`, package-dists, `schema.prisma`; géén broncode | `runtime-image/` | PASS: API start uit die bestandsset (poort 4200, zelfde staging-omgeving): `/health/ready` 200, 7 ketens, `version = runtime-image-check` |
| non-root `USER node`, `HEALTHCHECK`, `tini`, `read_only`, `no-new-privileges` | – | **niet getoetst** (vereist een container-runtime) |

Conclusie: de bouwstappen en de runtime-bestandsset kloppen; de containerlaag
zelf (isolatie, non-root, healthcheck, signalen via tini) moet in de CI-job
`containers` of op een machine met Docker worden aangetoond.

## 3. Database: TLS, beperkte runtime-gebruiker, migraties, back-up

| Controle | Resultaat | Bewijs |
|---|---|---|
| Server met `ssl = on`, client `sslmode=require` | PASS | `pg_stat_ssl`: `ssl = t`, TLSv1.3, `TLS_AES_256_GCM_SHA384`; met `sslmode=disable` → `ssl = f` (dus wel degelijk onderhandeld) |
| Runtime-rol via `infra/db/create-runtime-user.sql` (psql, `\gexec`, `-v password`) | PASS | `CREATE ROLE`; script is idempotent en roteert het wachtwoord |
| `superette_app`: `SELECT` werkt (16 gebruikers) | PASS | psql over TLS als `superette_app` |
| `superette_app`: `CREATE TABLE` / `DROP TABLE` / `ALTER TABLE` geweigerd | PASS | `permission denied for schema public`, `must be owner of table JobLease`, `must be owner of table User` |
| `superette_app`: `_prisma_migrations` lezen ja (3 rijen), `DELETE` nee | PASS | `permission denied for table _prisma_migrations` |
| `superette_app`: `INSERT`/`DELETE` op `JobLease` werkt | PASS | `insert ok` / `delete ok` |
| `statement_timeout 15s`, `CONNECTION LIMIT 40` | PASS | `show statement_timeout`, `pg_roles.rolconnlimit` |
| API en werkers draaien **als `superette_app` over TLS** | PASS | staging `DATABASE_URL` met `superette_app` en `sslmode=require`; imports (INSERT/UPDATE), sessies, lease en meldingen werken ermee (zie § 4–5) |
| `prisma migrate deploy` als eigenaar vóór de release | PASS | "3 migrations found … No pending migrations to apply" |
| Migratietest (drift, leeg, boetiekdata, rollback) tegen de TLS-server | PASS 19/19 | CI-job `migrations` |
| Back-up- en hersteloefening (`apps/api/scripts/backup-drill.sh`) | PASS 6/6 | `pg_dump` custom (148 kB, 1 s) → `pg_restore` in lege database (1 s) → 35 tabellen met identieke rijtellingen (o.a. User 16, ProductOffer 211, PriceHistory 209, Session 7, _prisma_migrations 3) → md5 over gebruikers en aanbiedingen identiek → `prisma migrate status` up to date op de hersteldatabase |
| Beheerde provider (snapshots, PITR, CA-geverifieerd certificaat) | **EXTERNAL BLOCKER** | geen beheerde PostgreSQL-dienst/credentials beschikbaar |

## 4. Omgevingsvalidatie in productie-modus (procesniveau)

`node dist/main.js` met `NODE_ENV=production` en de staging-omgeving, telkens
één onveilige waarde; verwacht: weigert te starten (exit 1) en noemt de
variabele.

| Onveilige waarde | Resultaat |
|---|---|
| `COOKIE_SECURE=false` | exit 1 — "Sessiecookies moeten Secure zijn in productie" |
| `TRUST_PROXY=false` | exit 1 — "Zet TRUST_PROXY (bv. 1) achter de reverse proxy…" |
| `APP_URL=http://…` / `SUPERETTE_WEB_URL=http://…` | exit 1 — "Moet https zijn in productie" |
| `COMPARE_ALLOW_DEMO=true` | exit 1 — "Demogegevens zijn niet toegestaan in productie" |
| `JWT_TTL_SECONDS=7200` | exit 1 — "Hoogstens 3600 seconden in productie" |
| `NOTIFY_EMAIL_ENABLED=true` zonder provider | exit 1 — "Kan niet aan zonder EMAIL_PROVIDER" |
| `EMAIL_PROVIDER=http` zonder URL/sleutel/afzender | exit 1 |
| `JWT_SECRET` < 32 tekens, `COMPARE_JOB_KEY` < 16, `MOLLIE_API_KEY` leeg | exit 1 (waarde in de boodschap geredigeerd) |
| ongeldige `ERROR_REPORTING_DSN` | exit 1 (nieuwe validatie; unit-test `env.test.ts` 9/9) |
| volledige veilige configuratie | start, `/health/ready` 200 |

Opmerking: de logredactie maskeert in deze meldingen ook het eerste woord na
`JWT_SECRET:`/`MOLLIE_API_KEY:` ("[redacted] moet minstens 32 tekens zijn");
cosmetisch, de variabelenaam blijft leesbaar.

## Bevindingen uit de staging-run die code of workflow hebben gewijzigd

| Bevinding | Gevolg zonder fix | Fix |
|---|---|---|
| `${{ env.* }}` in job-level `env` van de workflow | de jobs `smoke` en `accessibility` zouden op GitHub direct falen | letterlijke waarden op jobniveau |
| migratie-job zonder wegwerpsleutels | seed-CLI faalt op env-validatie → migratietest "0 ketens" | sleutelstap toegevoegd; migratietest meldt een falende seed nu expliciet |
| root-scripts `npm run --workspace … exec` | "Missing script: exec" met npm 11 | `npm exec --workspace …` (ook voor de bestaande `smoke:gate`/`smoke:shop`) |
| twee rooktests achter elkaar in één minuut | `429` op het sync-endpoint (5/min/IP) → vals alarm | wachtstap van 61 s in de workflow |
| werker logde een bezette lease als **ERROR** ("Er loopt al een synchronisatie") | elke minuut een valse fout naar de foutmonitoring bij ≥ 2 werkers | `worker.cli.ts` herkent `ConflictException` en logt `overgeslagen` op info-niveau |
| ongeldige `ERROR_REPORTING_DSN` werd pas bij het eerste event ontdekt | stille monitoring | validatie in `env.ts` (start weigert) |
| alerts negeren DEMO-prijzen in productie-modus (bewust) | staging met alleen DEMO-bestanden kan de alertpijplijn niet oefenen | `make-staging-feeds.ts --unverified <keten>`; rooktests krijgen `EXPECT_DEMO_ALERTS=false` |
| doorloop las het eerste €-bedrag van de preview (de voorgestelde doelprijs) als "laagste prijs" | fout-positief/negatief wanneer zin en laagste prijs verschillen | parser leest het bedrag ná "Huidige laagste prijs" |
| staging-tooling: `taskkill` met MSYS-PID uit `$!` doodt het Windows-proces niet | oude werkers bleven ongemerkt draaien (vijf werkers, voortdurende 409's) | werkerbeheer via PowerShell met echte Windows-PID's |
| staging-tooling: handmatige SQL schreef een lease-vervaltijd in lokale tijd (+02), terwijl Prisma `DateTime` als UTC zonder tijdzone bewaart | de "verlopen" testlease bleef twee uur geldig → valse 409's | `(now() at time zone 'utc')` in de testquery; runbook-tip voor wie ooit handmatig een lease vrijgeeft |

## 5. Belasting via de proxy en rechtstreeks

| Scenario | Verzoeken | Fouten | 429 | Mediaan | p95 | p99 |
|---|---|---|---|---|---|---|
| via HTTPS-proxy, 10 gebruikers, 20 s, **één IP** (limieten per IP gelden) | 314 (15 req/s) | 0 | 135 (zoeklimiet 60/min/IP) | 21 ms | 50 ms | 732 ms |
| rechtstreeks op de API, 20 gebruikers, 30 s, eigen IP per gebruiker (`TRUST_PROXY=1`, TLS-database, 2 werkers actief) | 942 (31 req/s) | 0 | 0 | 27 ms | 44 ms | 59 ms |

De 429's door de proxy zijn het gevolg van één gedeeld IP in de test; het
bewijst tegelijk dat de limieten ook achter de proxy per echt client-IP
werken (zie ook de XFF-spoofingcontrole in § 6). De p99-uitschieters via de
proxy (TLS-handshakes, koude cache) blijven onder 1,1 s zonder fouten.
