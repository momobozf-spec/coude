# Deployment

Hoe Superette (API, werker, app) naar staging en productie gaat. Dit document
beschrijft de **procedure**; niets hierin deployt vanzelf. Een productie-
deployment gebeurt pas na expliciete goedkeuring (zie `PRODUCTION-READINESS.md`).

## Onderdelen

| Onderdeel | Image / commando | Poort | Schaalbaar |
|---|---|---|---|
| API | `apps/api/Dockerfile` → `node dist/main.js` | 4000 | ja (stateless; sessies en leases in de database) |
| Werker | zelfde image → `node dist/compare/cli/worker.cli.js` | – | ja; de databaselease laat één synchronisatie tegelijk toe |
| Migratie | `apps/api/Dockerfile --target migrate` → `prisma migrate deploy` | – | eenmalige job vóór elke release |
| App | `apps/superette-web/Dockerfile` → `node apps/superette-web/server.js` | 3001 | ja (stateless) |
| Database | beheerde PostgreSQL 16/17 | 5432 | zie `DATABASE.md` |
| Reverse proxy | Caddy / nginx / Traefik / provider | 443 | TLS, HSTS, doorsturen |

De boetiek-PWA (`apps/pwa`) is ongewijzigd en deployt zoals voorheen (Render-
blueprint in de root); ze deelt alleen de API.

## Omgevingen

| | Staging | Productie |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| URL's | `https://staging.superette.be`, `https://api-staging.superette.be` | `https://superette.be`, `https://api.superette.be` |
| `COMPARE_ALLOW_DEMO` | `false` (demo kan niet aan in productie-modus; staging mag demodata via importbestanden met `source: DEMO` tonen) | `false` |
| Database | eigen beheerde instance, aparte gebruiker | eigen beheerde instance |
| Geheimen | aparte set, nooit gedeeld met productie | provider-secret-store |
| E-mail | `EMAIL_PROVIDER=file` of `none` | `http` met geverifieerde afzender, pas na test op staging |
| Foutmonitoring | eigen project/DSN | eigen project/DSN |

**App en API moeten op dezelfde site staan** (bv. `superette.be` en
`api.superette.be`, of één origin met een proxy op `/api`): de sessiecookies
zijn `SameSite=Lax/Strict` en host-only tenzij `COOKIE_DOMAIN` is gezet.

## Omgevingsvariabelen

Zie `.env.example` voor de volledige lijst met uitleg. De API valideert bij het
starten en weigert in productie te starten wanneer:

- `APP_URL` of `SUPERETTE_WEB_URL` niet `https://` is;
- `COOKIE_SECURE=false` of `TRUST_PROXY=false`;
- `JWT_TTL_SECONDS` > 3600;
- `COMPARE_ALLOW_DEMO=true`;
- `NOTIFY_EMAIL_ENABLED=true` zonder `EMAIL_PROVIDER`;
- `EMAIL_PROVIDER=http` zonder `EMAIL_HTTP_URL`, `EMAIL_API_KEY` en `EMAIL_FROM`;
- `MOLLIE_API_KEY` ontbreekt (boetiek);
- `JWT_SECRET` korter dan 32 tekens of de Ed25519-sleutels ontbreken.

De app bakt `NEXT_PUBLIC_API_URL` in bij de **build** (build-arg) en faalt
wanneer die ontbreekt of niet `https` is (localhost uitgezonderd). Alleen
publieke waarden mogen `NEXT_PUBLIC_` heten; `scripts/check-bundle-secrets.mjs`
controleert de bundel.

## Geheimen

- Genereren: `npm run keys:gen` (JWT-secret, Ed25519-paar), jobsleutel:
  `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
- Opslag: de secret-store van de hostingprovider of een vault. Nooit in de
  repository, nooit in een image, nooit in `docker-compose.prod.yml`.
- Rotatie jobsleutel: zet de oude in `COMPARE_JOB_KEY_PREVIOUS`, de nieuwe in
  `COMPARE_JOB_KEY`, herstart, werk de cron/werker bij, maak `_PREVIOUS` leeg.
- Rotatie `JWT_SECRET`: alle access-tokens (15 min) worden ongeldig; de
  refresh-cookies blijven werken (opaque, in de database). Gebruikers merken
  hoogstens één stille vernieuwing.

## Release-procedure

1. **CI groen** op de commit (`.github/workflows/superette-ci.yml`): typecheck,
   unit, migraties, rooktests, doorloop met axe, geheimenscan, audit, containers.
2. **Images bouwen** met `APP_VERSION=<git sha of tag>`:
   ```bash
   docker build -f apps/api/Dockerfile -t superette-api:$APP_VERSION .
   docker build -f apps/api/Dockerfile --target migrate -t superette-migrate:$APP_VERSION .
   docker build -f apps/superette-web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.superette.be/api/v1 -t superette-web:$APP_VERSION .
   ```
3. **Back-up** van de database (zie `DATABASE.md`), vóór elke migratie.
4. **Migreren**: `docker compose -f docker-compose.prod.yml run --rm migrate`
   (of de equivalente job). Controleer `prisma migrate status` → "up to date".
5. **API en werker** uitrollen (rolling: nieuwe instance gezond via
   `/api/v1/health/ready` vóór de oude stopt). `stop_grace_period` 30 s API,
   120 s werker (een lopende synchronisatie maakt af).
6. **App** uitrollen.
7. **Controle**: `GET /api/v1/health/live` en `/ready` → 200; `/health/status`
   met jobsleutel toont `version = APP_VERSION`; één zoekopdracht in de app;
   inloggen; `npm run smoke:auth` tegen staging met `EXPECT_SECURE_COOKIES=true`.
8. **Logboek**: versie, tijdstip, wie, resultaat (zie `RUNBOOK.md`).

Staging doorloopt exact dezelfde stappen eerst.

## Rollback

- **Applicatie**: de vorige image-tag uitrollen (`APP_VERSION` terug). Sessies
  blijven geldig; geen gegevensverlies.
- **Migratie**: alleen als het schema echt terug moet; procedure en
  down-scripts in `apps/api/prisma/rollback/README.md`. Altijd eerst een
  back-up; een rollback van `20261004210000_sessies_privacy_jobs` logt alle
  Superette-gebruikers uit.
- Een migratie die halverwege faalt: `prisma migrate status` toont de
  mislukte migratie; herstel de oorzaak, dan `prisma migrate resolve
  --rolled-back <naam>` en opnieuw `migrate deploy`. Elke migratie draait in
  één transactie, dus halve toestanden komen niet voor.

## Reverse proxy

Minimaal:

- TLS met moderne ciphers; HTTP → HTTPS redirect; HSTS (de API en de app zetten
  zelf `Strict-Transport-Security` in productie, de proxy mag dat ook).
- `X-Forwarded-For` en `X-Forwarded-Proto` doorgeven en **`TRUST_PROXY`** op
  het aantal hops zetten (meestal `1`). Zonder dit ziet de rate limiter één IP.
- Bodylimiet ≥ 64 kB voor `/api`, maar niet veel meer (de API weigert boven
  64 kB zelf met 413).
- Timeouts: 30 s voor `/api`, 10 s voor de app.
- Interne endpoints (`/api/v1/compare/internal/*`, `/api/v1/health/status`)
  mogen door de proxy extra afgeschermd worden (IP-allowlist); ze zijn ook
  met sleutel beschermd en weigeren browserverzoeken.

Caddy-voorbeeld:

```caddyfile
superette.be {
  encode zstd gzip
  reverse_proxy web:3001
}
api.superette.be {
  request_body { max_size 128KB }
  reverse_proxy api:4000
}
```

## Importbestanden en werker

- De werker leest `COMPARE_FEED_DIR` (volume `feeds`): `<adapterkey>.json` of
  `.csv` per keten, formaat in `apps/api/data/feeds/README.md`.
- Zonder bestand en zonder demo-toestemming levert een adapter niets: de keten
  staat op `UNAVAILABLE` in de app. Dat is de verwachte toestand in productie
  tot een keten contractueel is aangesloten (zie `COMPARE.md`, "Live-criteria").
- Cron-alternatief voor de werker: `node dist/compare/cli/sync.cli.js` elk uur,
  of `POST /api/v1/compare/internal/sync` met `x-job-key` vanaf een server.

## Staging zonder container-platform (lokaal oefenen)

De volledige keten is ook zonder Docker te oefenen, met dezelfde configuratie
als productie (gedaan op 5 oktober 2026, zie `STAGING-EVIDENCE.md`):

```bash
npm run staging:feeds -- ./data/feeds-staging --unverified spar   # DEMO-bestanden; spar als fictieve UNVERIFIED-bron (voor alerts)
# PostgreSQL met ssl=on; migreren als eigenaar; runtime-rol via infra/db/create-runtime-user.sql
NODE_ENV=production … node apps/api/dist/main.js    # API als superette_app, sslmode=require
node apps/api/dist/compare/cli/worker.cli.js        # werker(s)
node apps/superette-web/.next/standalone/apps/superette-web/server.js
TLS_CERT=… TLS_KEY=… npm run staging:proxy          # https://localhost:8443 → app en API
npm run ci:local                                    # de CI-workflow stap voor stap, lokaal
```

`scripts/staging-proxy.mjs` is uitsluitend voor staging/oefening; productie
gebruikt een echte reverse proxy met certificaatbeheer.

## Wat NIET in dit repo zit

- Echte geheimen, provider-configuratie, DNS, TLS-certificaten.
- Een gedeployde staging- of productieomgeving: er is op het moment van
  schrijven niets uitgerold.
