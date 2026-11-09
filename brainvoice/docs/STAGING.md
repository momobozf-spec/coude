# Local staging stack (First Real Alfred rehearsal)

This document describes the staging stack that was used on 2026-10-06/07 to rehearse the
"First Real Alfred" milestone **on a single Windows laptop, without Docker, without a cloud
account and without a real Google OAuth client**. Everything below is reproducible with the
script in `scripts/staging/`. Read "What this is not" before quoting any of it as proof of a
real-world capability.

## What runs

| Process | Entry | Notes |
|---|---|---|
| PostgreSQL 18 | local service, port 5432 | database `alfred_staging` (UTF-8), restricted role `alfred_app` |
| mock Gmail | `server/staging/mock-gmail.ts` (port 8790) | HTTP test double for the OAuth consent page, token endpoint and the Gmail REST calls Alfred uses |
| API | `server/index.ts` (HTTPS, port 8788) | bearer auth, rate limiting, security headers, `/api/ready`, OAuth callback, `ALFRED_EMBEDDED_WORKERS=0` |
| worker | `server/worker.ts` | all job kinds, 10 s poll, own heartbeat rows |
| scheduler | `server/scheduler.ts` | schedule ticks only, heartbeat row of kind `schedule` |

The four Node processes are separate OS processes with separate logs; the API never runs
workers. `/api/ready` returns `continuous: true` only while the worker **and** the scheduler
heartbeats are fresh.

## Layout of `ALFRED_STAGE_DIR`

```
run/staging.env      # every ALFRED_* / GMAIL_* variable (see .env.alfred.example)
run/generated.env    # API_TOKEN=… SECRET_KEY=… (generated once, sourced by staging.env)
tls/server.crt|key   # self-signed certificate with SAN localhost, alfred-staging.local, 127.0.0.1
logs/{mock,api,worker,scheduler}.log   # JSON lines (ALFRED_LOG_FORMAT=json)
```

Gmail is pointed at the mock through the endpoint overrides `GMAIL_OAUTH_AUTH_URL`,
`GMAIL_OAUTH_TOKEN_URL`, `GMAIL_OAUTH_REVOKE_URL` and `GMAIL_API_BASE_URL`. The server logs a
warning at start-up ("Gmail endpoints are overridden (staging mock) – this is NOT a real Gmail
connection") so a mock can never be mistaken for a real mailbox.

## Commands

```
export ALFRED_STAGE_DIR=/path/to/stage
scripts/staging/alfred-staging.sh up        # mock → api (waits for /api/health) → worker → scheduler
scripts/staging/alfred-staging.sh status
scripts/staging/alfred-staging.sh restart worker   # any of: mock api worker scheduler
scripts/staging/alfred-staging.sh logs worker
scripts/staging/alfred-staging.sh down
```

Processes are found by their entry file through PowerShell (`Get-CimInstance Win32_Process`) and
stopped with `taskkill /T /F`, because `$!` of a Git Bash background job is not the Windows pid.

Mock control endpoints (test only, never part of Alfred):

```
POST /__control/messages   {from,to,subject,text,...}   # drop a message in the inbox
GET  /__control/sent                                      # what Alfred "sent"
GET  /__control/state                                     # counters, failMode
POST /__control/fail       {"mode":"network"|"ok"}        # simulate an outage (socket destroyed)
```

## What was verified here (2026-10-06/07, times UTC)

| Capability | Evidence |
|---|---|
| HTTPS with verified TLS | `curl --cacert tls/server.crt` → `ssl_verify_result=0`; HSTS, nosniff, `x-frame-options: DENY`, referrer-policy, cache-control, `x-request-id` present |
| Auth + rate limiting | 401 without bearer; 429 after 20 failed attempts per minute (the shared limiter also throttles the OAuth callback – by design) |
| Readiness | `/api/ready` → `ok`, dialect postgres, `continuous: true`, 7 worker heartbeats + 1 scheduler heartbeat; 503 when the database is unreachable |
| OAuth loop | consent → callback → encrypted credential row in `provider_credentials` (AES-256-GCM, key `ALFRED_SECRET_KEY`); no plaintext token in the database or logs |
| Scheduled mailbox poll | mail #1 injected 15:23:38 → detected by the 15-minute schedule at 15:34:10, imported once, `TASK_REQUEST`, task proposal due 2026-10-09, ticket created, label `Alfred/Processed` added, nothing sent |
| Unattended OPERATOR flow | mail #2: plan `email.briefing → email.suggest → email.draftReply → email.send`, ticket `WAITING_APPROVAL`, approval card with full recipient/subject/body, mock `sent` empty |
| Approve → send in thread | approval 08:14:44 → worker run 2 at 08:14:51 → mock received one message in thread `t-m0002` with `In-Reply-To`/`References`; `audit_log` row `email.send` confirmed+ok; draft `sent`; still exactly one message 30 s later |
| Third mail after the fixes | mail #3 injected 08:51:53 after the second restart → imported by the 09:01 poll; draft body is a neutral acknowledgement (not the drafting guideline), shown in full on the approval card; approval 09:01:55 → sent 09:02:07 in thread `t-m0003` with `In-Reply-To`; ticket result `done – Verzonden aan Sara De Smet` with per-step detail lines; the morning briefing line reads the same; still 2 sent messages 30 s later |
| Scheduled night-shift ticket | "Alfred, maak vannacht een overzicht van alles wat nog openstaat voor mijn projecten." created 08:17:28 for 08:19:56 → picked up by the SLA schedule at 08:21:12 (5-minute cadence) → `admin.weeklyReview` → `COMPLETED` 08:21:15, exactly one `ticket.process` job |
| Morning briefing from server state | `runBriefing('morning')` at 08:25:46: "Wat Alfred voorbereidde" lists the night-shift ticket and the mail ticket, "Wacht op jouw goedkeuring" lists the pending approval, health "Server-worker actief (24/7)" |
| Restart recovery | API, worker and scheduler restarted one by one (twice: 2026-10-06 15:41 and 2026-10-07 08:50); credentials, schedules, tickets, approvals and the mock-sent count survived; `/api/ready` returned `continuous: true` with 8 heartbeats within 25 s |
| Lease recovery | a `running` job with an expired lease held by a fake dead worker was reclaimed by the maintenance worker (attempt 2) and finished 11 s later |
| Failure / retry | mock `failMode=network` from 08:31:40; the 08:46 scheduled poll failed (`fetch failed`, attempt 1 at 08:46:13), retried after the 30 s backoff (attempt 2 at 08:46:53, failed), was re-queued for 08:47:56 (62 s backoff); health showed `queue.delayed: 1`; mock restored at 08:47:06 → attempt 3 at 08:48:03 succeeded with `imported 0, duplicates 1`; emails, tickets and sent counts unchanged (no duplicate domain action) |
| Secrets in logs | grep of api/worker/scheduler logs (224 lines) for access/refresh tokens, the OAuth code, the API token, the secret key, the client secret, `Bearer` and mail-body phrases: 0 hits; the credential row holds ciphertext only (`secret_enc`, 260 chars) and its `meta_json` has no token; every HTTP line carries `requestId`, every job line `jobId`/`ticketId`/`scheduleId`/`attempt`/`ms`/`result` |

## What this is not

- **Not a cloud deployment.** The host is a laptop. Windows modern standby suspended all four
  processes from 2026-10-06 15:50 to 2026-10-07 08:01 UTC (Kernel-Power events 506/507); the
  "overnight" jobs ran as catch-up at 08:01. A real night shift needs a host that does not sleep.
- **Not a real Gmail account.** The mock implements the handful of Gmail endpoints Alfred calls; it
  proves Alfred's side of the protocol (query, dedup by message id, label, RFC 2822 reply with
  threading headers, token refresh), not Google's behaviour or quota, and not a real OAuth consent.
- **No physical phone, no push.** Notifications were produced on the server (`in_app: delivered`,
  `push: skipped – no delivery provider configured`); nothing was received on a device.
- **No LLM.** Drafts and classifications are the deterministic paths. A reply drafted from
  Alfred's own guideline is a neutral acknowledgement (never the guideline text itself); the user
  reviews it on the approval card before anything is sent.

## Gotchas learned here

- Run the API first and wait for `/api/health` before starting worker/scheduler: migrations are
  serialised with `pg_advisory_xact_lock(727031)` but starting four processes at once still
  raced on a fresh database before that lock existed.
- The worker and scheduler cache settings; `SettingsService.reload()` runs before every tick so an
  autonomy change made through the API is picked up by the other processes within one poll.
- The PostgreSQL databases must be UTF-8 (`CREATE DATABASE … ENCODING 'UTF8' TEMPLATE template0`)
  and every pooled connection sets `client_encoding` to UTF8, otherwise ✓/– characters in
  notifications fail with "byte sequence … WIN1252".
- Inserting a parser rule through a shell heredoc mangles `\s`; write such files with an editor or
  a JSON file.
