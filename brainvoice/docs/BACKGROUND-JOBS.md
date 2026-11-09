# Background jobs – the durable queue, workers and scheduler

How Alfred does work when nobody is looking, and what guarantees the code actually gives.
Everything here is in `src/core/ops` (pure TypeScript, tested with Vitest against a real
SQLite engine) and is hosted either by the app (while open) or by the Node server (24/7).

## Storage choice

The queue lives in the **same SQLite database as the rest of the data** (`jobs`,
`job_attempts`, `schedules`, `outbox_events`, `worker_heartbeats`; migration 4). Reasons:

* one data model for the phone and the server, no second datastore to deploy;
* a durable ticket, its jobs and its approvals change in one transaction when needed;
* the SQL is portable: conditional `UPDATE … WHERE status = 'queued'`, `ON CONFLICT DO NOTHING`
  on a partial unique index and compare-and-set updates all run on Postgres unchanged.

The workers only know the `JobQueue` interface (`src/core/ops/queue/JobQueue.ts`);
`SqlJobQueue` is the implementation. Swapping in Postgres means providing a `SqlDriver`
(see `src/core/db/SqlDriver.ts`) – the queue code does not change. Adding `FOR UPDATE SKIP
LOCKED` to the candidate query is an optional Postgres optimisation.

## Guarantees

| Concern | Mechanism | Test |
|---|---|---|
| Exactly-one claim | conditional `UPDATE` flips `queued → running`; the worker whose update changed 1 row owns the job | `JobQueue … lets exactly one worker claim a job` |
| Crashed worker | lease (`locked_until`); an expired lease makes the job claimable again, attempts increase | `… expired lease claimable again` |
| Lost lease | `complete`/`fail` only succeed for `locked_by = worker`; otherwise `JOB_LEASE_LOST` | same |
| Bounded retries | `max_attempts` + exponential backoff with deterministic jitter (`backoffMs`), 30 s → 1 h | `… retries with backoff and stops after max attempts` |
| Permanent failures | `PermanentJobError` / `INVALID_ARGUMENTS`, `NOT_FOUND`, … never retry | `… never retries a permanent failure` |
| Idempotent enqueue | unique partial index on `idempotency_key`, insert with `ON CONFLICT DO NOTHING`, existing job returned | `… enqueues idempotently by key` |
| Cancellation | queued → cancelled at once; running → `cancel_requested`, honoured at completion | `… cancels queued jobs immediately …` |
| Scheduler double-fire | enqueue key `schedule:<id>:<plannedRun>` + compare-and-set on `next_run_at` | `fires an interval schedule once per slot` |
| Catch-up after downtime | next run computed from *now*, so a missed daily briefing fires once, not N times | `Scheduler – next run` |

Failed jobs end in the **Failed Job Center** (`/ops/failed`): retry (attempts reset) or cancel,
never silent loops.

## Job types and workers

| Worker kind | Job types |
|---|---|
| ticket | `ticket.process` (orchestrator run), `ticket.create` (from schedules), `ticket.sla_check` |
| email | `email.poll` (provider → import → triage), `email.triage` |
| workflow | `workflow.run`, `followup.scan`, `crm.scan` |
| briefing | `briefing.morning`, `briefing.evening`, `briefing.night_shift`, `night_shift.run` |
| notification | `notification.send` |
| outbox | `outbox.publish` (transactional outbox dispatch) |
| maintenance | `maintenance.sweep` (expired approvals/questions/quotes, stale heartbeats, purge) |

`JOB_TYPES_BY_WORKER` in `src/core/ops/workers/handlers.ts` is the single source of truth. A
host creates one worker per kind (server) or one worker for all kinds (app).

Every handler calls the **same services, Tool Registry, permission levels, approvals and
audit log** as the interactive Butler. A worker that runs a `sensitive`/`external` tool does
so only through an `APPROVED` approval record; the registry would refuse `confirmed: false`
anyway. There is no background path with fewer controls.

## Built-in schedules (seeded by migration 4)

| Schedule | Spec | Job |
|---|---|---|
| Mailbox check | every 15 min | `email.poll` |
| Morning briefing | daily 08:00 | `briefing.morning` |
| Evening review | daily 18:00 | `briefing.evening` |
| Night shift | daily 23:00 | `night_shift.run` (report 45 min later) |
| Ticket pickup | every 5 min | `ticket.sla_check` (INBOX → QUEUED after the pickup SLA) |
| Waiting-for scan | daily 09:00 | `followup.scan` |
| Event dispatch | every 1 min | `outbox.publish` |
| Maintenance sweep | every 5 min | `maintenance.sweep` |
| CRM scan | Monday 08:30 | `crm.scan` |

Times are evaluated in the schedule's IANA zone (`timezone` column; `NULL` = host clock),
with Luxon, so 08:00 stays 08:00 across DST. Cron (5 fields), interval, daily, weekly and
one-time specs are supported (`src/core/ops/schedule/nextRun.ts`). Natural-language
automations ("Elke maandag om 9u: geef me de open facturen") become schedules whose job
creates a ticket (`automationParser.ts`).

## Hosts

* **App (IMPLEMENTED LOCALLY)** – `src/runtime/ops.ts` runs one all-kinds worker plus the
  scheduler every 15 s while the app is in the foreground. It pauses in the background. Mission
  Control and the morning briefing say so: *"Workers run inside the app while it is open – not
  24/7."*
* **Server (READY FOR CLOUD DEPLOYMENT)** – `server/index.ts` runs the API with embedded
  workers and scheduler (`npm run dev`), or `npm run worker` / `npm run scheduler` as separate
  processes against the same database file. See `docs/DEPLOYMENT.md`.

System Health reports `continuous: true` only when a *server-mode* worker sent a heartbeat in
the last 3 minutes. Nothing else may claim 24/7 operation.

## Transactional outbox

State changes that other parts react to (`ticket.created/status/completed/failed/blocked`,
`approval.requested/approved/rejected/expired`, `question.asked/answered`, `followup.overdue`)
are written as `outbox_events` rows – inside the same transaction when the writer owns the
transaction (tickets). `outbox.publish` dispatches them to in-process subscribers:
notifications, the workflow engine (`ticket.completed`, `followup.overdue` triggers) and CRM.
No broker; a failed handler retries up to 5 times and is then marked failed with the error.

## PostgreSQL (production)

The same `SqlJobQueue` runs on PostgreSQL through `server/db/PostgresDriver.ts`. Differences that
matter for concurrency, verified in `server/postgres.test.ts` against PostgreSQL 18:

| Operation | SQLite | PostgreSQL |
|---|---|---|
| Claim | candidate select + conditional `UPDATE` (single writer) | one `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *` – parallel workers never block or double-claim |
| Idempotent enqueue | partial unique index + `ON CONFLICT … DO NOTHING` | identical; ten parallel enqueues → one row |
| Sequence numbers | `INSERT … ON CONFLICT … RETURNING value` | identical; ten parallel calls on two pools → 1…10 |
| Scheduler advance | compare-and-set on `next_run_at` | identical; two parallel advances → one winner |
| Lease | `locked_until` compared as text | identical |

The scheduler writes its own heartbeat (`worker_heartbeats`, kind `schedule`) per tick; System
Health reports `continuous: true` only when a server-mode worker **and** a server-mode scheduler are
alive.
