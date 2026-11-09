# Deploying Alfred (the 24/7 part)

Status categories: **IMPLEMENTED LOCALLY** (runs in this repo, tested), **READY FOR CLOUD
DEPLOYMENT** (code + container exist, not deployed by us), **ACTUALLY DEPLOYED** (nothing – no
deployment was performed), **REQUIRES PROVIDER CREDENTIALS**, **REQUIRES DEVICE TEST**,
**REQUIRES EXTERNAL HARDWARE**.

## Architecture (connected mode)

```
phone (app)  ──HTTPS bearer──▶  Alfred API  ──▶  PostgreSQL (source of truth)
   notes/tasks/alarms/calendar      │  embedded or separate: workers + scheduler
   stay on the device               │  Gmail (OAuth tokens encrypted at rest)
                                    └─▶ Expo push → phone
```

* **Local mode** (no server URL in Settings → Alfred): everything runs on the phone while the app
  is open; SQLite on the device. Never 24/7.
* **Connected mode** (server URL + token): the server owns tickets, jobs, approvals, questions,
  schedules, email triage, CRM, follow-ups, briefings, audit and AI usage. The app understands
  and executes Butler commands on the server (`understand` / `executeBatch` RPC), reads
  administrative data through the allow-listed `call` RPC and never starts local workers. The
  phone keeps only device-bound work (notes, tasks, alarms, timers, calendar, reminders).
* No two-way sync: switching modes does not migrate existing local data (known limitation).

| Piece | Status |
|---|---|
| Central backend (API + workers + scheduler) | IMPLEMENTED LOCALLY, READY FOR CLOUD DEPLOYMENT – runs with `npm run dev`; HTTP, Gmail flow and rate limiting covered by `server/http.test.ts` |
| PostgreSQL persistence | IMPLEMENTED – `server/db/PostgresDriver.ts`; verified against PostgreSQL 18 with concurrent claims (`server/postgres.test.ts`, `npm run test:pg`) |
| Mobile → server (connected mode) | IMPLEMENTED (client + RPC), REQUIRES DEVICE TEST – the HTTP client and RPC are tested, the screens were not run on a phone here |
| Workflow approval resume | IMPLEMENTED, tested on SQLite and PostgreSQL |
| Gmail read / send after approval | IMPLEMENTED against Gmail-shaped payloads (`src/core/email/gmail/gmail.test.ts`, `src/core/ops/triage.e2e.test.ts`); REQUIRES PROVIDER CREDENTIALS for a real mailbox |
| 24/7 operation | **not true until the server runs somewhere** – System Health reports it only from live server worker **and** scheduler heartbeats |
| Push notifications (Expo) | READY FOR CLOUD DEPLOYMENT + REQUIRES DEVICE TEST |
| Home Assistant | REQUIRES EXTERNAL HARDWARE + CREDENTIALS |
| TLS, rate limiting, readiness, JSON logs | IMPLEMENTED (`server/http.ts`), not exercised on a public host |

## Local development

```bash
cd brainvoice
cp .env.alfred.example .env.alfred     # set ALFRED_API_TOKEN (or ALFRED_ALLOW_ANONYMOUS=1 locally)
export $(grep -v '^#' .env.alfred | xargs)   # PowerShell: set the variables, or use a dotenv loader
npm run dev          # API + workers + scheduler, reloads on change (tsx watch)
npm run worker       # workers only
npm run scheduler    # scheduler only
npm run check        # tsc + eslint + vitest (SQLite)
ALFRED_TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/alfred_test npm run test:pg
curl http://localhost:8787/api/health
curl http://localhost:8787/api/ready
curl -X POST http://localhost:8787/api/ops/createTicket -H "authorization: Bearer $ALFRED_API_TOKEN" -H "content-type: application/json" -d '{"args":[{"text":"Maak een factuur voor klant Acme voor 2 dagen aan 750 euro"}]}'
```

Without `DATABASE_URL` the server uses SQLite (`ALFRED_DB_PATH`, default `./data/alfred.db`).
Migrations run automatically at start on either engine (`schema_migrations`).

## PostgreSQL

* Set `DATABASE_URL` (and `DATABASE_SSL=1` for managed databases, `DATABASE_SCHEMA` optional).
  The database must be **UTF-8** (`createdb --encoding=UTF8`; the driver also forces
  `client_encoding = UTF8` per connection – Windows servers default to WIN1252).
* The repositories use portable SQL; the driver converts `?` placeholders and the four SQLite
  idioms (`INSERT OR IGNORE`, `strftime(…,'now')`, `json_extract`, `rowid`→`seq`, plus
  `COLLATE NOCASE` removal). Dialect-specific migration statements exist only where a table
  needs `seq BIGSERIAL` for insertion order.
* Concurrency semantics verified on PostgreSQL 18 (`server/postgres.test.ts`): job claims use one
  statement with `FOR UPDATE SKIP LOCKED` (twelve parallel claims on two pools → each of six
  jobs claimed exactly once), lease expiry and lost-lease rejection, idempotent enqueue under
  ten parallel calls, sequence counters via `INSERT … ON CONFLICT … RETURNING`, scheduler
  compare-and-set, approval persistence across two independent pools, workflow pause/resume.
* Case-insensitive tag lookup (`COLLATE NOCASE`) becomes case-sensitive on PostgreSQL (minor).

## Docker

```bash
docker build -f Dockerfile.alfred -t alfred-server .
POSTGRES_PASSWORD=… docker compose -f docker-compose.alfred.yml up -d
```

One `api` container (embedded workers + scheduler) plus `db` (PostgreSQL 16, UTF-8). For separate
processes set `ALFRED_EMBEDDED_WORKERS=0` and enable the `worker` / `scheduler` services; several
workers and two schedulers are safe (row locks, compare-and-set).

## HTTPS and hardening

* TLS: either `ALFRED_TLS_CERT` / `ALFRED_TLS_KEY` (the server speaks HTTPS itself) or a reverse
  proxy (Caddy/nginx/Traefik) with `ALFRED_TRUST_PROXY=1` so rate limits see client addresses.
* Authentication: bearer token (`ALFRED_API_TOKEN`), compared in constant time. The app stores it
  in the device keychain.
* Rate limiting: `ALFRED_RATE_LIMIT_PER_MINUTE` per address for authenticated calls; 20/min for
  failed authentication and OAuth callbacks (429 with `retry-after`).
* Secrets: environment only; provider tokens encrypted with `ALFRED_SECRET_KEY` (AES-256-GCM) in
  `provider_credentials`. Nothing secret is logged.
* Health: `GET /api/health` (liveness), `GET /api/ready` (database ping + worker and scheduler
  heartbeats; 503 when the database is down). Workers heartbeat per job, the scheduler per tick.
* Logs: `ALFRED_LOG_FORMAT=json` gives one JSON object per line (time, level, scope, msg, meta).
* Security headers on every response; request bodies capped at 1 MB.

## Connecting the app

Settings → Alfred → *Alfred server URL* (`https://…`) and *Server token*. From then on the app is in
connected mode (Mission Control, commands and administrative screens use the server). *Register
this device for push* sends the Expo push token (needs notification permission and an EAS project
id in `app.config.ts` `extra.eas.projectId`).

## Gmail

1. Google Cloud → OAuth consent screen → client of type *Web application*; authorised redirect URI
   `https://<ALFRED_PUBLIC_URL>/api/auth/gmail/callback`.
2. Server env: `ALFRED_EMAIL_PROVIDER=gmail`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
   `ALFRED_PUBLIC_URL`, `ALFRED_SECRET_KEY`.
3. App: Settings → Alfred → *Connect Gmail* opens Google's consent page; the callback lands on the
   server, which stores the refresh token encrypted. The phone never sees tokens.
4. The built-in *Mailbox check* schedule polls every 15 minutes (configurable) through the
   provider; triage creates proposals, tickets and approval cards; sending happens only through an
   approved `email.send` card, in the original thread (`In-Reply-To`), and is audited.
5. Status: Settings → Alfred shows *Connected as …*, *needs reconnect* (refresh token revoked) or
   *REQUIRES PROVIDER CREDENTIALS*. System Health says `monitoring: true` only when the provider is
   ready **and** a server worker and scheduler are alive.

## Staging rehearsal

A complete local staging stack (separate API, worker and scheduler processes on PostgreSQL 18,
HTTPS with a self-signed certificate, and a mock Gmail) was run on 2026-10-06/07; see
[STAGING.md](STAGING.md) for the layout, the commands and the evidence table.

## Not done here

No cloud account, domain, certificate, Google OAuth client or physical phone was available: nothing
is deployed to a cloud host, no real Gmail account was connected (the staging run used a mock),
push was never received on a device and a real night shift was not observed (the laptop that hosted
the staging stack went into modern standby overnight). The final report states this per item.
