# Productiegereedheid — Superette

Stand van zaken op **4 oktober 2026**, na de productiehardening. Elk punt
heeft een status en bewijs (test, bestand of meting). Niets is gedeployd; dit
document is de basis voor een go/no-go.

Statussen: **PASS** (gedaan en aangetoond) · **PARTIAL** (gedaan, met een
bekende beperking) · **BLOCKED** (kan hier niet, vereist mens/omgeving) ·
**NOT APPLICABLE**.

## Update 24 oktober 2026 (productieklaar maken, vergelijker)

| Punt | Status | Bewijs |
|---|---|---|
| `npm test` volledig groen, `data/**` en backups uitgesloten | PASS | `apps/api/vitest.config.ts`; zie verslag voor aantallen |
| `npm audit --omit=dev` | PASS | 0 kwetsbaarheden: next 15.5.28, zod 4.6.7, overrides multer 2.5 / deepmerge-ts 8 |
| Boetiek uit in productie (`BOUTIQUE_ENABLED=false`) | PASS | `src/app.module.test.ts`: boetiekroutes 404, geen MQTT |
| Feeds naar productie zonder schijf | PASS (unit/HTTP) | `POST /compare/internal/feeds/:chain`, `npm run feeds:push`, 17 HTTP-tests; tegen een echte DB nog te draaien op de laptop |
| Productie-guard (demo, zwakke geheimen, adres, http, dev-scanner) | PASS | `src/config/env.test.ts`, `src/gate/dev-device-key.check.test.ts` |
| Juridische teksten nl/fr/en | PARTIAL | concept; jurist moet nalezen |
| Render-blueprint | PARTIAL | `render.yaml`; nog nooit uitgerold |
| Databronnen | BLOCKED | alle feeds `termsReviewed: false` (UNVERIFIED); juridische beslissing van de uitbater |

## Samenvatting

| Gebied | Status | Kern |
|---|---|---|
| Authenticatie en sessies | PASS | HttpOnly/Secure/SameSite-cookies, 15 min access, refresh-rotatie met hergebruikdetectie, server-side intrekking, logout, CSRF |
| Autorisatie en invoer | PASS | eigendom in de service-laag, Zod overal, 64 kB bodylimiet, rate limits, één foutvorm met request-id |
| Interne jobs | PASS | sleutel met rotatie, constant-time, Origin-weigering, databaselease, timeouts/retry, auditlog, deactivatiegrens |
| Headers en CSP | PASS | nonce + strict-dynamic, geen `*`, geen `unsafe-eval` in productie; API `default-src 'none'` |
| Privacy | PARTIAL | export en verwijdering met herauthenticatie werken; privacyverklaring is een voorstel dat een jurist moet goedkeuren, fr/en ontbreken |
| Database | PARTIAL | migraties getest (leeg, boetiekdata, rollback, drift); beheerde PG-config en beperkte gebruiker gedocumenteerd; back-up/restore niet geoefend (geen `pg_dump` lokaal) |
| Logging en monitoring | PARTIAL | JSON-logs met redactie, request-id, live/ready/status, alarmdefinities; geen foutmonitoringprovider gekoppeld |
| E-mail | PARTIAL | transportlaag klaar en getest met bestandsoutbox; geen provider gekoppeld |
| Toegankelijkheid | PASS | axe-core (WCAG 2.1 A/AA + best practices) op alle routes zonder serious/critical; structuur en toetsenbord in de doorloop |
| Prestaties | PASS (lokaal) | zie meting; productiemeting op staging nodig |
| Demo/live-scheiding | PASS | bronstatus per keten, live-criteria, demo onmogelijk in productie; de API scrapet niet zelf (feeds komen van scrapers op de laptop, zie COMPARE.md) |
| Deployment | PARTIAL | Dockerfiles, compose, env-validatie, graceful shutdown, proxy-docs; containerbuild niet lokaal uitgevoerd (geen Docker), `.next/standalone` niet lokaal te bouwen (OneDrive) |
| CI/CD | PARTIAL | workflow geschreven met alle poorten; nog nooit gedraaid (niets gepusht) |
| Documentatie | PASS | DEPLOYMENT, DATABASE, SECURITY, MONITORING, RUNBOOK, PRIVACY, COMPARE, dit document |

## Laatste lokale meting (4 oktober 2026)

| Controle | Resultaat |
|---|---|
| `npm run typecheck` (web, api, contracts, pricing; strikte TypeScript, geen ESLint in de repo) | 0 fouten |
| `npm test` (vat 13 · pricing 61 · api 147 · web 23) | 244/244 |
| `npm run smoke:compare` | 104/104 |
| `npm run smoke:auth` | 94/94 (Secure-vlag overgeslagen: alleen tegen https) |
| `npm run smoke:lease` | 13/13 |
| `npm run db:migrate:test` | 10/10 (drift, leeg, boetiekdata, rollback) |
| `npm run check:bundle` | geen geheimen/tokens/sourcemaps in 39 bestanden |
| `npm run loadtest` (20 gebruikers, 30 s) | 957 verzoeken, 0 fouten, p95 34 ms |
| `npm run walkthrough:superette` (productiebuild via `next start`, `EXPECT_PRODUCTION_CSP=true`, axe op elke route) | 207/207; axe 0 overtredingen; 10 schermafbeeldingen in `docs/screenshots-superette/` |
| `npm run build -w @superette/pwa` (regressie boetiek-app) | geslaagd |
| API-log na alle rooktests | geen jobsleutel, wachtwoord, e-mailadres of Bearer-token (grep) |
| `npm audit --omit=dev` | 0 critical, 3 high (prisma → deepmerge-ts, CLI-pad, geaccepteerd) |

## Checklist met bewijs

### 1. Authenticatie, sessies, CSRF

| Punt | Status | Bewijs |
|---|---|---|
| Geen token in `localStorage`/`sessionStorage`/bundel | PASS | walkthrough "geen token in localStorage"; `scripts/check-bundle-secrets.mjs` ✓ (39 bestanden) |
| HttpOnly + SameSite cookies, `Secure` in productie | PASS | `smoke:auth` cookie-attributen; `COOKIE_SECURE` niet uit te zetten in productie (`env.ts`); `Secure` zelf alleen tegen https te testen → **op staging** |
| Kort access-token (15 min), refresh 30 d | PASS | `WEB_ACCESS_TTL_SECONDS` default 900, max 3600 |
| Refresh-rotatie + hergebruikdetectie | PASS | `smoke:auth` "hergebruik … → 401 SESSION_REUSE", hele sessie ingetrokken |
| Server-side intrekking (logout, verwijdering) | PASS | `smoke:auth` "access-token na logout geweigerd", "ook de Bearer-sessie … weg" |
| CSRF | PASS | `smoke:auth` 403 zonder clientheader, 403 vreemde Origin, 201 met beide |
| CORS alleen eigen origins, credentials, geen `x-job-key` | PASS | `smoke:auth` CORS-blok |
| Boetiek-PWA ongewijzigd (Bearer) | PASS | `smoke:auth` Bearer-pad; `smoke:compare` 104 checks; PWA-build geslaagd |
| Wachtwoord-reset / e-mailverificatie | BLOCKED | vereist e-mailprovider |

### 2. Autorisatie, validatie, limieten, fouten

| Punt | Status | Bewijs |
|---|---|---|
| Eigendom server-side (lijsten, alerts, meldingen, voorkeuren) | PASS | `smoke:compare` IDOR-checks; walkthrough "Bob ziet de lijst/alert van Alice niet" |
| Zod op alle invoer | PASS | `ZodValidationPipe` op body en query; `smoke:auth` 400 met `issues` |
| Payloadlimieten | PASS | `smoke:auth` 100 kB → 413 in de standaardfoutvorm |
| Rate limits login/registratie/sessie/zoeken/alerts/sync/export/verwijdering | PASS | tabel in `SECURITY.md`; `smoke:auth` 429 + `Retry-After` |
| Consistente foutobjecten + request-id | PASS | `HttpExceptionFilter` (unit-test 5/5); `smoke:auth` 401/404/413/429-vorm |
| Rate limits gedeeld over instances | PARTIAL | in-memory per instance; bij >1 instance effectief ×n |

### 3. Interne jobs

| Punt | Status | Bewijs |
|---|---|---|
| Sterke sleutel, rotatie, constant-time, nooit gelogd | PASS | `JobKeyGuard`; `smoke:auth` vorige sleutel geldig; log-grep na smoke: sleutel komt niet voor |
| Browserverzoeken geweigerd | PASS | `smoke:auth` Origin → 403 `INTERNAL_ONLY` |
| Eén synchronisatie tegelijk (cluster) | PASS | `JobLease`; `smoke:auth` twee gelijktijdige → [201, 409] |
| Verlopen lease / crash | PASS (ontwerp) | lease verloopt na 20 min, heartbeat elke ≥ 5 s; niet met een echte crash getest |
| Timeouts en retries per adapter | PASS | `withTimeout` + `fetchSnapshotWithRetry` (2 pogingen) |
| Idempotent | PASS | dubbele seed geeft geen dubbele rijen (migratietest B/D); meldingen met idempotency-key |
| Half bestand beschadigt geen prijzen | PASS | `MAX_FAILURE_RATIO = 0.2` → deactivatie overgeslagen, run `PARTIAL` |
| Auditlog | PASS | `SyncAudit`-regels met request-id, duur, mislukte adapters |

### 4. Headers, CSP, XSS

| Punt | Status | Bewijs |
|---|---|---|
| App-CSP met nonce, `strict-dynamic`, geen `*`, geen `unsafe-eval` (prod) | PASS | walkthrough headerchecks tegen `next start`; `force-dynamic` zodat de nonce op Next's scripts staat (gevonden en opgelost via de doorloop) |
| `style-src 'unsafe-inline'` | PARTIAL (bewust) | React-inline-styles voor ketenkleur/tooltip; gedocumenteerd in `SECURITY.md` |
| API-headers | PASS | `smoke:auth` nosniff/DENY/no-referrer/CSP/CORP, geen `x-powered-by` |
| XSS-review | PASS | geen `dangerouslySetInnerHTML` in de app; e-mailsjablonen escapen (unit-test) |

### 5. Privacy

| Punt | Status | Bewijs |
|---|---|---|
| Accountverwijdering met herauthenticatie + bevestigingszin | PASS | `smoke:auth` (401 fout wachtwoord, 400 zin, 204) en walkthrough-dialoog |
| Verwijder-/anonimiseringsbeleid | PASS | `PRIVACY.md`; dialoog legt uit wat weg/blijft |
| Gegevensexport | PASS | `smoke:auth` + walkthrough-download (JSON, geen hashes/ids) |
| Privacyverklaring | PARTIAL | `/privacy` (nl) als voorstel; **juridische controle vereist**; fr/en ontbreken; verwerkingsverantwoordelijke placeholder |
| Verwerkersovereenkomsten | BLOCKED | providers nog niet gekozen |

### 6. Database

| Punt | Status | Bewijs |
|---|---|---|
| Externe/beheerde PostgreSQL met SSL, pooling, beperkte gebruiker | PARTIAL | gedocumenteerd (`DATABASE.md`, `infra/db/create-runtime-user.sql`); niet tegen een echte beheerde instance getest |
| Migraties: leeg, boetiekdata, productie-achtige kopie, rollback, rijtellingen | PASS | `apps/api/scripts/migration-test.sh` 10/10 (lokaal, Postgres 18.4) |
| `prisma migrate deploy` als enige weg | PASS | scripts, Docker `migrate`-target, docs |
| Back-up en restore geoefend | BLOCKED | geen `pg_dump`/`pg_restore` op deze machine; procedure in `DATABASE.md` |

### 7. Logging, health, monitoring

| Punt | Status | Bewijs |
|---|---|---|
| Gestructureerde logs met redactie | PASS | `StructuredLogger` + `redact` (unit-tests); log-grep na smoke: geen wachtwoord/sleutel |
| Liveness / readiness / DB-check | PASS | `smoke:auth` live/ready; 503 bij DB-timeout (code) |
| Status laatste import/alertcontrole, versie | PASS | `/health/status` met sleutel |
| Alarmdefinities | PASS | `MONITORING.md` |
| Foutmonitoringprovider | PARTIAL | `ERROR_REPORTING_DSN` gereserveerd; niets gekoppeld |

### 8. E-mail

| Punt | Status | Bewijs |
|---|---|---|
| Provider-interface zonder verzending zonder config | PASS | `EMAIL_PROVIDER=none` → `EMAIL_UNAVAILABLE`; `file`-transport in `smoke:auth` (mail in outbox met demo-vermelding en afmeldlink) |
| Opt-in / afmelden | PASS | `emailNotifications` (default uit) in voorkeuren; `EMAIL_DISABLED_BY_USER` |
| Retries / idempotentie | PASS (ontwerp) | permanente 4xx niet herhaald, tijdelijke wel; idempotency-key per digest; `http`-transport niet tegen een echte provider getest |

### 9. Toegankelijkheid

| Punt | Status | Bewijs |
|---|---|---|
| axe-core (WCAG 2.1 A/AA + best practices) op alle routes: home, zoeken, product, lijsten, lijst, alerts, meldingen, profiel, voorkeuren, inloggen, registreren, promoties, over-de-gegevens, privacy, 404 | PASS | walkthrough tegen de productiebuild: 0 serious/critical op elke route. De eerste scan vond 6–17 contrastfouten per pagina (witte initialen op lichte ketenkleuren), een `<ul>` met niet-`<li>`-kinderen en een 404 zonder `h1`; alle drie opgelost (`--chart-N-ink`, `<li>`-wrapper, sr-only `h1`) |
| Resterende axe-opmerkingen (moderate) | PARTIAL | `heading-order` op zoeken opgelost (kaarttitels `h2`); geen andere moderate/minor meldingen in de laatste run |
| Toetsenbord, skip-link, landmarks, labels, lang | PASS | walkthrough `a11y()` per route |
| Schermlezer (NVDA/VoiceOver) | BLOCKED | handmatige test nodig |

### 10. Prestaties

Meting lokaal (Windows, embedded Postgres, API via `node dist/main.js`,
`TRUST_PROXY=1`, elke virtuele gebruiker een eigen IP):

| Scenario | Verzoeken | Fouten | 429 | Mediaan | p95 | p99 |
|---|---|---|---|---|---|---|
| 20 gebruikers, 30 s, denktijd 50–250 ms (agressief) | 3 499 (116 req/s) | 0 (0,00 %) | 888 (zoeklimiet 60/min/IP) | 16 ms | 33 ms | 55 ms |
| 20 gebruikers, 30 s, denktijd ~600 ms (realistisch, `npm run loadtest`) | 957 (31 req/s) | 0 (0,00 %) | 0 | 20 ms | 34 ms | 42 ms |

Per endpoint (realistisch scenario): zoeken mediaan 20 ms / p95 33 ms,
productdetail 25 / 37 ms, ketens 15 / 29 ms, health 8 / 19 ms. Eén uitschieter
van 766 ms op `/compare/chains` (koude cache van de embedded database).

Interpretatie: zonder fouten; de 429's in het agressieve scenario zijn de
zoeklimiet die zijn werk doet (een echte gebruiker zoekt geen 2× per seconde).
Productiemeting op staging met productie-achtige data is nodig vóór go-live.

### 11. Demo/live-isolatie

| Punt | Status | Bewijs |
|---|---|---|
| Bronstatus per keten (`UNAVAILABLE/DEMO/STALE/UNVERIFIED/LIVE`) | PASS | `sourceStatusOf` (unit-tests), `/compare/chains`, badge in de app |
| Live-criteria vastgelegd | PASS | `COMPARE.md`, "Bronstatus en live-criteria" |
| Demo onmogelijk in productie | PASS | `env.ts` weigert `COMPARE_ALLOW_DEMO=true` bij `NODE_ENV=production` |
| Geen scraping-adapter | PASS | geen enkele adapter haalt HTML op; alleen bestanden/feeds |
| Echte ketendata | BLOCKED | geen enkele keten heeft `termsReviewed: true`; overeenkomsten zijn mensenwerk |

### 12. Deployment en CI

| Punt | Status | Bewijs |
|---|---|---|
| Multi-stage, non-root Dockerfiles met healthcheck, tini | PASS (geschreven) | `apps/api/Dockerfile`, `apps/superette-web/Dockerfile`, `.dockerignore` |
| Containerbuild uitgevoerd | BLOCKED | geen Docker op deze machine; CI-job `containers` doet het |
| `output: 'standalone'` | PARTIAL | geconfigureerd; lokaal faalt "Collecting build traces" door OneDrive (bestanden online-only); `next start` werkt; verifiëren in CI |
| Env-validatie, graceful shutdown | PASS | `env.ts`, `enableShutdownHooks`, werker wacht lopende run af, tini |
| Web/API/werker gescheiden | PASS | `docker-compose.prod.yml`, `worker.cli.ts` |
| Reverse-proxy, HTTPS, staging/productie, rollback | PASS | `DEPLOYMENT.md` |
| CI met alle poorten | PARTIAL | `.github/workflows/superette-ci.yml` geschreven; **nooit gedraaid** (niets gepusht); lokaal zijn alle stappen behalve containers en gitleaks uitgevoerd |
| Dependency-audit | PARTIAL | 0 critical; 3 high via `prisma → deepmerge-ts` (CLI-pad, geaccepteerd, `SECURITY.md`) |
| Secret scan | PARTIAL | gitleaks in CI; lokaal alleen de bundelcontrole |

## Bestaande problemen (niet door deze wijzigingen veroorzaakt)

- Boetiek-PWA: Bearer-token in `localStorage`; één `dangerouslySetInnerHTML`
  (QR-SVG uit eigen code). Buiten scope, gedocumenteerd.
- `prisma`/`deepmerge-ts` high-audit zonder fix zonder downgrade.
- Geen ESLint in de repo (strikte TypeScript via `npm run typecheck`).
- Ontwikkelomgeving: de repo staat in OneDrive; bestanden worden "online-only"
  gemaakt, wat Postgres-tabelbestanden, `initdb.exe` en Next's build traces
  breekt. Workaround: `DEV_DB_DIR`/`DEV_DB_PORT` buiten OneDrive.

## Go / no-go

**Staging: GO** — zodra een beheerde PostgreSQL, een hostingomgeving met
reverse proxy en de geheimen beschikbaar zijn, kan de release-procedure uit
`DEPLOYMENT.md` worden gevolgd. Verwachte eerste bevindingen op staging: de
`Secure`-cookievlag, HSTS, de `standalone`-build in Docker, de CI-run.

**Productie: NO-GO** — blokkerend:

1. Juridische goedkeuring van de privacyverklaring (en gebruiksvoorwaarden),
   verwerkersovereenkomsten, identiteit van de verwerkingsverantwoordelijke.
2. Geen enkele keten heeft geverifieerde, toegestane data: in productie zou de
   app alleen `UNAVAILABLE` tonen (demo is daar onmogelijk). Dat is correct
   gedrag, maar geen product.
3. CI nog nooit gedraaid; containerbuilds niet lokaal te verifiëren.
4. Back-up/restore niet geoefend; foutmonitoring niet gekoppeld.
5. Staging-doorloop (`smoke:auth` met `EXPECT_SECURE_COOKIES=true`,
   walkthrough tegen https) nog niet gedaan.
