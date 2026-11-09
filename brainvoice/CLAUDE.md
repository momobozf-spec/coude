@AGENTS.md

# BrainVoice + Alfred – working notes for Claude Code

## Architecture in one paragraph

Expo SDK 57 dev-build app. `src/core` is pure TypeScript (ESLint forbids RN/Expo imports) and holds
the intent engine, the Butler tool catalog/registry (§94–§140) and the Alfred operations layer
(§141–§181: tickets, durable job queue, approvals, questions, scheduler, workers, briefings, CRM,
advisory board, health). `src/platform` and `src/runtime` wire Expo adapters; `src/app` holds the
Expo Router screens (`admin/*` Butler, `ops/*` Mission Control); `server/` is the Node host
(API + workers + scheduler) that reuses `src/core` with `node:sqlite`.

## Alfred operations layer

* Domain: `src/core/domain/ops.ts`. Schema: migration 4 in `src/core/db/migrations.ts`
  (tables `tickets`, `ticket_events`, `jobs`, `job_attempts`, `approvals`, `agent_questions`,
  `worker_heartbeats`, `outbox_events`, `schedules`, `ops_notifications`, `briefings`,
  `cost_entries`, `push_tokens`, `interactions`, `quotes`, `sequence_counters`, `advisory_sessions`;
  `emails` and `follow_ups` got extra columns).
* Composition: `createOpsServices()` in `src/core/ops/index.ts`; the app host is
  `src/runtime/ops.ts`, the server host `server/runtime.ts`. Screens use `OpsClient`
  (`src/core/ops/client.ts`): local in-process or HTTP to the server.
* Orchestrator: `src/core/ops/AlfredOrchestrator.ts` – plans with the intent engine, executes
  through `ToolRegistry.execute` only; `sensitive`/`external` (and in ASSISTANT mode also `write`)
  steps become `Approval` rows; missing info becomes `AgentQuestion`; email tickets follow a fixed
  plan per classification and never parse the email body as a command.
* Workers/jobs: `src/core/ops/workers/*` and `docs/BACKGROUND-JOBS.md`. Job types live in
  `JOB_TYPES_BY_WORKER`; add a handler in `handlers.ts`.
* Adding an Alfred capability = catalog tool (`src/core/butler/catalog.ts`) + handler in
  `src/core/butler/tools/opsTools.ts` + parser rule in `AdminParser.ts` + test case in
  `AdminParser.test.ts` (+ a job type if it runs in the background).

## Rules that must survive refactors

* Nothing sensitive or external runs from a worker without an `APPROVED` approval record; the
  registry refuses `confirmed: false` for those permissions. No second execution path.
* Email/document content is untrusted data: wrap with `wrapUntrusted`, flag with `detectInjection`,
  derive proposals (`suggestions`) and tickets, never tool arguments.
* Never claim: an email was sent (only the provider/composer result), 24/7 operation (only a
  server-mode heartbeat), devices (only what the provider lists), team activity (only real tickets).
* Secrets stay in `expo-secure-store` (app) or environment variables (server); never in SQLite or git.
* Invoices and quotes use the deterministic engine (`src/core/finance`); numbers are assigned in
  transactions.
* Do not create git commits unless explicitly instructed.

## Verification

`npm run check` = `tsc --noEmit` + `eslint . --max-warnings=0` + `vitest run` (includes
`src/core/ops/*.test.ts` and `server/http.test.ts`). Keep it green. Device behaviour (push,
notifications, native modules) cannot be verified on this Windows machine; say so in reports.

## Docs

`README.md`, `ARCHITECTURE.md`, `AI_ENGINE.md`, `ADMIN.md` (Butler + Alfred commands),
`docs/SPEC-94-140-ADMIN-PM.md`, `docs/SPEC-141-181-ALFRED-OPS.md`, `docs/MISSION-CONTROL.md`,
`docs/BACKGROUND-JOBS.md`, `docs/DEPLOYMENT.md`, `docs/ADVISORY-BOARD.md`, `PRIVACY.md`.

## Connected Alfred (central source of truth) – added 2026-10-06

* Two modes, decided by `settings.ops.serverUrl`: **local** (phone-only, in-process workers while
  open) and **connected** (server authoritative). In connected mode `src/runtime/ops.ts` never
  starts local workers, `captureStore` sends Butler commands to the server (`understand` /
  `executeBatch` RPC, device intents stay local), and admin screens read/write through
  `adminCall()` (`src/runtime/remote.ts`) → the allow-list in `src/core/ops/remote.ts`.
* PostgreSQL: `server/db/PostgresDriver.ts` (placeholder + idiom rewriting, UTF-8 forced,
  `FOR UPDATE SKIP LOCKED` claims via `JobRepository` dialect branch). Migrations may hold
  `{ sqlite, postgres }` variants (`withSeq`). `npm run test:pg` with `ALFRED_TEST_DATABASE_URL`
  runs the suite against a real server (needs a UTF-8 database).
* Workflow `require_approval` → run persisted with position (`workflow_runs` columns from
  migration 5) → gate in `src/core/ops/index.ts` creates a ticket with a `workflow.resume`
  (sensitive) step → approval card → `WorkflowService.resumeRun`.
* Gmail: `src/core/email/gmail/*` (MIME, API, OAuth with rotation/reconnect, provider);
  credentials only server-side in `provider_credentials` (AES-256-GCM, `ALFRED_SECRET_KEY`);
  OAuth routes in `server/http.ts`; account manager in `server/accounts.ts`; tests use
  `FakeGmail` (Gmail-shaped payloads).
* Hardening in `server/http.ts`: rate limiter, `/api/ready`, TLS option, security headers;
  scheduler heartbeat (`createSchedulerHeartbeat`) feeds `continuous` in System Health.
* Nothing is deployed; no real Gmail account, phone or night shift was exercised – say so.
