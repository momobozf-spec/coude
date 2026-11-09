# Mission Control

The operations screen of Alfred (spec §143). It shows only what the database says: tickets,
approvals, questions, schedules, the activity derived from the ticket history and the audit
log, and a System Health block that never extrapolates.

## Where

* App: Butler tab → *Mission Control* card → `/ops` (`src/app/ops/*`). Also *Settings → Alfred*.
* Voice/text: "Wat staat er in de wachtrij?", "Wat wacht op mijn goedkeuring?", "Maak een ticket: …",
  "Geef me mijn ochtendbriefing", "Draait Alfred nog?" (see `ADMIN.md`, Alfred section).
* Server: the same data through `POST /api/ops/<method>` (`docs/DEPLOYMENT.md`).

The screens read through one `OpsClient` (`src/core/ops/client.ts`). Without a server URL it is
the in-process `LocalOpsClient`; with `settings.ops.serverUrl` it is the `HttpOpsClient`. The two
hosts keep separate databases – there is no sync (known limitation).

## Views

| View | Statuses | Notes |
|---|---|---|
| Inbox | `INBOX` | created, waits for the pickup SLA (30 min default) or *Start now* |
| Queue | `QUEUED` | a `ticket.process` job exists |
| Working | `WORKING` | a worker holds the job lease |
| Waiting | `WAITING_APPROVAL`, `WAITING_QUESTION`, `WAITING_EXTERNAL` | your decision, your answer, or child tickets |
| Blocked | `BLOCKED` | role not allowed, repo/AI/home unavailable, expired approval/question – *Retry* re-queues |
| Scheduled | `SCHEDULED` | starts at `scheduledFor` |
| Completed | `COMPLETED` | result with outcome `done` / `prepared` / `needs_user` / `nothing_to_do` and evidence |
| Failed | `FAILED`, `CANCELLED` | reason recorded; *Retry* allowed |
| Projects | tickets per project | links to the project screen |
| Team activity | per role: tickets in progress, completed today, waiting | derived from real tickets only |
| System health | workers, queue, failures, email/home/AI, cost | see below |

## Ticket detail

Title, status, priority, role + routing reason, source, the request text, the result (summary,
detail, evidence with links), the open question (options + free text), the pending approval, the
plan (tool steps with status), sub-tickets, actions (*Start now*, *Retry*, *Cancel*) and the
full history (`ticket_events`, append-only). The estimated AI cost of the ticket is shown when
cloud AI was used.

## Approvals

Every card has **WHAT** (the tool preview), **WHY** (ticket + step), **SOURCE** (the email or
request), **IMPACT** (external / financial / local) and **CONTENT** (the draft, invoice summary,
quote or arguments). Actions:

* **APPROVE** – queues a resume job; the worker executes exactly the stored tool call with
  `confirmed: true`; the audit log records it.
* **EDIT** – your instruction is applied (email drafts are refined through `email.refineDraft`),
  the old card expires and a new card appears.
* **REJECT** – the ticket is cancelled with outcome `rejected`; nothing runs.
* **ASK ALFRED** – a child ticket answers in the card's notes (deterministic from the card,
  better with cloud AI).

Approvals expire after 7 days (configurable); the ticket becomes BLOCKED, not forgotten.

## Questions

One open question per ticket; options and/or free text. Answering re-queues the ticket. The
engine's clarification question, ambiguous matches and "I did not understand this" all use it.

## System Health (truthful)

* `mode`: `none` / `in_process` / `server` / `mixed`, from worker heartbeats (3-minute window).
* `continuous`: **only** when a server-mode worker is alive. The app's own workers never count.
* queue depth, running, failed, delayed, oldest due job; ticket counts; pending approvals; open
  questions; outbox backlog; enabled schedules; last mailbox check; last briefing.
* email: provider id, `monitoring` (provider can list **and** is ready **and** a server worker
  runs), `canSend`.
* home automation: provider id and connection; AI availability; estimated cost today.
* warnings in plain language ("No worker is running …", "Workers run inside the app only …",
  "No mailbox is monitored …").

## Notifications

Every approval request, question, completed/failed/blocked ticket and briefing creates an in-app
notification row. On the device a local notification is scheduled while the app runs. With the
server and a registered Expo push token, the server's `ExpoPushSink` sends a push (delivery is
reported as *accepted by Expo*; REQUIRES DEVICE TEST).

## Connected mode (central source of truth)

With a server URL in Settings → Alfred the app becomes a client of Alfred:

* Mission Control, approvals, questions, schedules, briefings, activity and health come from the
  server (`HttpOpsClient`).
* Butler commands are understood and executed on the server (`understand` / `executeBatch`);
  device-only intents (alarms, timers, calendar, reminders, notes, tasks) still run on the phone.
  If the server is unreachable, device commands fall back to local understanding; Butler commands
  fail visibly instead of running against the phone's database.
* Administrative screens (invoices, clients, projects, email, documents, timesheets, expenses,
  proposals, business profile, audit) read and write through the allow-listed `call` RPC
  (`src/core/ops/remote.ts`).
* In-process workers are off; the phone never competes with the server's queue.
* The mailbox card in Settings → Alfred shows the Gmail account state and starts the consent flow.
