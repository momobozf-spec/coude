# BrainVoice – Architecture & Decision Record

_Status: living document. Last updated 2026-09-23._

BrainVoice is a voice-operated "second brain + command center" for iOS and Android.
The user speaks, the app understands the intent (note, idea, task, reminder, calendar
event, alarm, timer, query…), shows a preview, and executes it against the real device
capabilities (calendar, reminders, alarms, notifications) or against the local brain
database.

This document records the architecture and every non-trivial engineering decision.
Each decision is an ADR (Architecture Decision Record). Decisions marked **[verified]**
were checked against current official documentation on 2026-09-23.

---

## 1. Goals and non-goals

**Goals**

* Capture-first: thought → speak → understood → stored/actioned in seconds.
* Local-first: everything works without an account; the primary database is on-device.
* Real native integrations (EventKit, Reminders, AlarmKit, Android AlarmClock, notifications,
  Siri / App Intents, Android shortcuts) instead of fake local stand-ins.
* Strong typing end-to-end. AI output is never executed before runtime validation (Zod).
* Deterministic-first NLU: common commands parse locally, offline, in Dutch / English / French.
  An LLM is used only for the long tail, through a provider abstraction.

**Non-goals for v1**

* Always-listening / wake-word ("Hey Brain…"). See §8.
* Mandatory cloud sync. A `SyncAdapter` interface exists; no implementation ships in v1.
* Writing into Apple Notes. Apple exposes no public write API for Notes. See §8.

---

## 2. Decision summary (ADRs)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| ADR-001 | App framework | **Expo SDK 57 / React Native 0.86, development builds + Continuous Native Generation (prebuild)**. Never Expo Go. **[verified]** | Expo provides maintained modules for SQLite, EventKit/CalendarContract, notifications, secure storage and speech, plus the Expo Modules API to write Swift/Kotlin where needed. Custom native code (AlarmKit, App Intents, AlarmClock intents) is added with a local Expo module + config plugins, so we keep CNG instead of ejecting. |
| ADR-002 | Navigation | **Expo Router** (file-based, built on React Navigation 7) | Current best-supported option in the Expo ecosystem; gives deep-link → screen mapping for free, which App Intents, Siri, Android shortcuts, widgets and notification actions all rely on (`brainvoice://capture?text=…`). |
| ADR-003 | Language | **Strict TypeScript**, no `any`, `noUncheckedIndexedAccess` | User requirement, and the intent engine is safety-critical. |
| ADR-004 | Local database | **expo-sqlite** with hand-written migrations, FTS5 virtual table for full-text search **[verified: `enableFTS` default true]** | Structured relational data with migrations; FTS5 gives fast full-text search without a vector DB. |
| ADR-005 | DB access from domain code | `SqlDriver` interface. `ExpoSqliteDriver` in the app, `NodeSqliteDriver` (built-in `node:sqlite`) in tests | Domain services and repositories are pure TypeScript and are tested against a real SQLite engine in Node, with the same migrations. |
| ADR-006 | Date/time | **Luxon** with an explicit IANA zone on every operation. Own `DateResolver` (no chrono-node) | We need Dutch idioms ("half zeven" = 06:30, "kwart voor acht" = 07:45), French ("14h", "moins le quart"), English, DST-correct arithmetic, and full control over ambiguity policies. Everything resolves in the device timezone; examples use Europe/Brussels. |
| ADR-007 | Validation | **Zod 4** schemas for every command; the schema is the contract between parser, LLM, validator, UI and router | Runtime validation of untrusted AI output. |
| ADR-008 | State | **zustand** stores for UI state; the capture flow is a pure reducer (`captureFlowReducer`) | Small, testable, no boilerplate. |
| ADR-009 | Speech-to-text | **expo-speech-recognition** (SFSpeechRecognizer on iOS, `SpeechRecognizer` on Android) behind a `VoiceInputService` interface **[verified]** | Live interim results, on-device option, multi-locale. The interface lets a future wake-word or Whisper implementation plug in. |
| ADR-010 | Calendar | **expo-calendar** (EventKit on iOS, CalendarContract on Android) behind `CalendarAdapter` **[verified]** | Real calendar items; undo = `deleteEventAsync(externalId)`. |
| ADR-011 | Reminders | iOS: EventKit Reminders via expo-calendar `createReminderAsync` (+ alarm). Android: local reminder + scheduled notification (Android has no system reminders store) | Closest legitimate native equivalent per platform. |
| ADR-012 | Alarms | iOS: **AlarmKit** (iOS 26+) via local Swift Expo module; fallback time-sensitive notification on < iOS 26. Android: **`AlarmClock.ACTION_SET_ALARM` / `ACTION_SET_TIMER`** intents via local Kotlin Expo module **[verified]** | These are the only supported ways to create a *real* clock-app alarm/timer. Android intents cannot target a specific date (time + repeat days only), so one-off "tomorrow 06:30" becomes a time alarm plus a local notification safety net; documented in §8. |
| ADR-013 | Notifications | **expo-notifications** behind `NotificationAdapter`, with categories/actions (Complete, Snooze) **[verified]** | Reminder fallback, timer fallback, and confirmation UX. |
| ADR-014 | AI provider | `AIProvider` interface; `AnthropicProvider` (Messages API with structured output `output_config.format`, validated again with Zod), `NullProvider` for offline/deterministic-only. Keys live in `expo-secure-store` (user-provided) or a proxy backend (`proxy/`) | No vendor lock-in, no secrets in git. |
| ADR-015 | Tests | **Vitest** for domain code (`src/core`) incl. repositories on `node:sqlite` | Fast, no React Native runtime required; the risky logic (dates, intents, validation, routing) is pure TS. |
| ADR-016 | Native additions | Local Expo module in `modules/brainvoice-native` + config plugins in `plugins/` for App Intents Swift sources, Info.plist keys, App Group, Android shortcuts and widget receiver | Keeps `ios/` and `android/` generated; all native additions are reproducible with `npx expo prebuild`. |
| ADR-017 | Butler orchestration (spec §137–§140) | One new intent `BUTLER_TOOL` carrying `{ tool, args, permission, preview }`; a static **Tool Catalog** (Zod schema + permission + localized preview per tool) shared by the `AdminParser`, the validator, the LLM prompt and the `ToolRegistry`; the `ActionRouter` executes tools after the usual preview/confirm flow | Reuses the existing engine, cards, history and undo instead of a second pipeline; every capability has a validated schema and a permission level (§138). |
| ADR-018 | Deterministic-first administration | `AdminParser` regex rules per language for the §132 commands; the LLM may pick a tool only through the same catalog and returns dates as phrases; `workflow/parse.ts` grammar for automations | Offline, predictable, testable (≈95 fixture sentences); the LLM is a long-tail helper, never an authority. |
| ADR-019 | Money and invoices | Integer cents everywhere; VAT per rate group; invoice numbers from `invoice_counters` inside the same SQLite transaction as the invoice update; totals re-verified before render/pay; Belgian structured communication with mod-97 check | Spec §103–§104: deterministic engine, never a reused number, LLM never trusted for calculations. |
| ADR-020 | Financial & external safety | Permission levels `read / write / sensitive / external`; `CommandValidator` adds `CONFIRM_REQUIRED` so sensitive/external tools can never auto-execute; `ToolRegistry` refuses them without `confirmed`; audit log rows for every non-read execution; `email.send` goes through a sending adapter or the system composer | Spec §134: no transfers, no payment approval, no unconfirmed sending; strong audit trail. |
| ADR-021 | Untrusted content | Email/document/meeting text is wrapped in `<untrusted_*>` tags with explicit rules in every prompt; deterministic `detectInjection` flags instruction-like text; derived actions become **proposals** (`suggestions` table) that the user approves | Spec §135 and §127: content never becomes an instruction; nothing appears silently. |
| ADR-022 | Conversation focus | `ConversationState.focus` (email, draft, invoice, project, expense, document, proposals; 2 h TTL) patched by tool results and consumed by the parser | Spec §96/§139 continuity: "Stuur.", "Maak het professioneler.", "Dit was voor project X.", "Maak daarna een reminder voor die factuur." resolve without repeating the target. |
| ADR-023 | Email transport | `EmailAdapter` (sync/send) + `MailComposer` contracts; v1 ships `LocalEmailAdapter` (import by paste/share) and a `mailto:` composer | Keeps the domain independent of Gmail/IMAP/OAuth, which cannot be verified on this machine; the seam exists for a real sync adapter. |

---

## 3. Layering

```
┌──────────────────────────────────────────────────────────────────┐
│ UI (Expo Router screens, components)                             │
│   src/app/**, src/features/**, src/ui/**                          │
├──────────────────────────────────────────────────────────────────┤
│ Application layer (composition root, hooks, stores)               │
│   src/runtime/**  – wires services, exposes hooks and stores       │
├──────────────────────────────────────────────────────────────────┤
│ Domain / core (pure TypeScript, no React Native imports)           │
│   src/core/intent   – IntentEngine, parsers, validator, context    │
│   src/core/date     – DateResolver (nl/en/fr)                      │
│   src/core/commands – ActionRouter, adapter interfaces, undo       │
│   src/core/services – Capture/Task/Note/Agenda/Search/History      │
│   src/core/db       – SqlDriver, migrations, repositories          │
│   src/core/ai       – AIProvider abstraction, prompt, LLM parser   │
├──────────────────────────────────────────────────────────────────┤
│ Platform adapters (React Native / Expo / native modules)           │
│   src/platform/**   – ExpoSqliteDriver, Calendar/Reminder/Alarm/   │
│                       Notification adapters, VoiceInputService     │
│   modules/brainvoice-native – Swift (AlarmKit, App Intents bridge) │
│                               Kotlin (AlarmClock intents, widget)  │
└──────────────────────────────────────────────────────────────────┘
```

Rule: **business logic never imports iOS/Android APIs**. `src/core` has an ESLint
restriction that forbids importing `react-native`, `expo-*` or `../platform`.

---

## 4. Intent Engine pipeline

```
Voice / Text
   ↓  VoiceInputService (transcript, live interim results)
   ↓
IntentEngine.process(input)
   1. normalise text, detect language (nl | en | fr, device locale as prior)
   2. ContextResolver – merge with pending clarification / last proposal
        ("make that 3 instead", "Friday morning" answering "when?")
   3. DeterministicParser – regex/lexicon parser per language → CommandBatch
   4. if no/low-confidence result and AI is enabled → LLMParser (AIProvider)
        · LLM returns date *phrases*, never trusted absolute dates
        · every date phrase is re-resolved locally by DateResolver
        · output is validated with Zod; invalid output is discarded
   5. CommandValidator – missing fields, past dates, invalid ranges, duplicates
   6. Decision policy (configurable thresholds)
        ≥ 0.90 → preview (auto-execute allowed for safe intents if enabled)
        0.65 – 0.89 → preview + explicit confirmation
        < 0.65 or missing required field → clarification question
   ↓
ActionPreview (UI) – edit / confirm / cancel, stack for batches
   ↓
ActionRouter.execute(command) → adapter (Calendar / Reminder / Alarm / Timer /
   Task / Note / Notification / Query) → ActionResult { summary, externalIds, undo }
   ↓
HistoryService – action_history row (command, intent, result, undo status)
```

Commands are a discriminated union validated by `CommandSchema` (`src/core/intent/schema.ts`).
Dates in commands are always **resolved ISO values in the device zone** plus the original
phrase, so the UI can show "Tomorrow 08:00" and the router never re-interprets text.

---

## 5. Data model (SQLite)

Tables (all with `id TEXT PRIMARY KEY`, ISO-8601 timestamps, soft delete where relevant):

* `captures` – every input, original transcript preserved (`original_text`, `transcript_json`)
* `notes` – title, content, category, favorite, archived, folder
* `tasks` – title, description, due_date, due_time, priority, status, recurrence_json,
  reminder_at, parent_task_id (subtasks), external_json
* `events` – local mirror of calendar events we created (external_id, calendar_id)
* `reminders` – local reminders (+ external_id for EventKit reminder or notification id)
* `alarms` – alarms/timers we created (+ external_id: AlarmKit UUID / notification id)
* `tags`, `item_tags` – many-to-many tags for any item type
* `categories` – customisable categories with defaults seeded
* `item_links` – links between items ("linkedItems")
* `action_history` – command, parsed intent, executed action, external ids, undo status
* `conversation_context` – pending clarification / last proposal (short TTL)
* `settings` – key/value (typed accessor layer on top)
* `external_integrations` – calendar id in use, permissions state, AlarmKit availability…
* `search_index` – FTS5 virtual table (falls back to LIKE search if FTS5 is unavailable)
* `outbox` – queued captures waiting for AI when offline

Migrations live in `src/core/db/migrations.ts` and run in order inside a transaction;
the applied version is stored in `schema_migrations`.

---

## 6. Platform integration matrix

| Capability | iOS | Android | Notes |
|---|---|---|---|
| Speech-to-text | SFSpeechRecognizer via expo-speech-recognition | `SpeechRecognizer` via expo-speech-recognition | Live interim results; on-device optional |
| Calendar events | EventKit (expo-calendar) | CalendarContract (expo-calendar) | Real event, undo via delete |
| Reminders | EventKit Reminders (expo-calendar) | Local reminder + scheduled notification | Android has no reminders store |
| Alarm | AlarmKit (iOS 26+) native module; notification fallback | `AlarmClock.ACTION_SET_ALARM` native module | Android: time + weekdays only |
| Timer | AlarmKit countdown (iOS 26+); in-app timer + notification fallback | `AlarmClock.ACTION_SET_TIMER` | AlarmKit countdown UI needs a Live Activity extension (optional) |
| Notifications | UserNotifications | NotificationManager channels | Actions: Complete / Snooze |
| Siri / Shortcuts | App Intents (`AppShortcutsProvider`) | App Shortcuts (`shortcuts.xml`) | Deep links into the router |
| Widget | WidgetKit (extension target – documented, optional) | AppWidgetProvider via config plugin | See IOS_INTEGRATION.md |
| Share sheet | System share via `Share` API | idem | |

---

## 7. Shared TypeScript vs native code

Shared TypeScript (≈ 95 %): everything in `src/core`, all screens, all adapters that
Expo modules already cover (calendar, reminders, notifications, speech, SQLite,
secure store).

Swift (`modules/brainvoice-native/ios`):
* `BrainVoiceNativeModule.swift` – AlarmKit bridge (`isAlarmKitAvailable`,
  `requestAlarmAuthorization`, `scheduleAlarm`, `scheduleTimer`, `cancelAlarm`),
  pending App-Intent queue reader (App Group `UserDefaults`).
* `BrainVoiceAppIntents.swift` (added to the app target by the `withAppIntents`
  config plugin) – `CaptureThoughtIntent`, `CreateTaskIntent`, `CreateReminderIntent`,
  `AddCalendarEventIntent`, `SetAlarmIntent`, `AskBrainVoiceIntent`, `OpenBrainInboxIntent`,
  `BrainVoiceShortcuts: AppShortcutsProvider`.

Kotlin (`modules/brainvoice-native/android`):
* `BrainVoiceNativeModule.kt` – `AlarmClock` intents (`setAlarm`, `setTimer`,
  `dismissAlarm`, `showAlarms`), clock-app availability check.
* `BrainVoiceWidgetProvider.kt` + layout/xml resources – "Tap to capture" widget
  (registered by the `withAndroidWidget` config plugin).

---

## 8. Genuine OS restrictions (and what we do instead)

1. **Apple Notes has no public write API.** Notes live in BrainVoice's own database;
   they are exposed through App Intents and can be exported via the share sheet.
2. **Wake-word / always listening.** iOS does not allow third-party apps to listen in
   the background for a custom hotword; Android restricts background microphone use.
   v1 uses tap-to-talk, Siri/App Intents ("Hey Siri, capture with BrainVoice"),
   Action Button (via Shortcut), Android app shortcuts and a widget.
   `VoiceInputService` is an interface so a future implementation can be added.
3. **AlarmKit requires iOS 26.** On older iOS versions the closest legitimate
   alternative is a time-sensitive local notification; the UI says so explicitly.
   AlarmKit countdown timers show a live countdown only if the app ships a Live
   Activity (widget extension); without it the timer still fires as an alert.
4. **Android `ACTION_SET_ALARM` has no date.** It accepts hour, minute, label and
   repeat days. For "tomorrow 06:30" we set the 06:30 alarm (fires next occurrence)
   and additionally schedule an exact local notification as a safety net.
   Undo uses `ACTION_DISMISS_ALARM` with label search (best effort, clock-app dependent).
5. **Android has no system Reminders store.** Reminders are stored locally and
   delivered via scheduled notifications. Exact alarms (`SCHEDULE_EXACT_ALARM`) are
   requested only for reminders/alarms, never for ordinary notifications.
6. **iOS widgets need a separate extension target.** Config plugins can add it but
   this cannot be compiled or verified on the Windows machine this project was
   built on; the WidgetKit code is provided under `native/ios-widget/` with
   step-by-step instructions instead of an unverified plugin.
7. **Siri background execution.** App Intents run in the app process. Intents that
   need the database open the app (`openAppWhenRun = true`); the `CaptureThoughtIntent`
   can also run in the background by writing to an App-Group queue that the app drains
   on next launch.

---

## 9. Privacy & local-first

* Raw audio is **not** retained (expo-speech-recognition `recordingOptions.persist` = false).
* Transcripts are stored; the user can delete any capture and its transcript.
* Cloud AI is opt-in. The Privacy screen shows exactly what is sent (the text of the
  command and minimal context; never calendar, notes or contacts in bulk).
* Permissions are requested lazily, at the moment the feature is used.
* The microphone state is always visible (LISTENING banner + system indicator).

---

## 10. Testing strategy

* `src/core/**` – Vitest unit tests: DateResolver (nl/en/fr, DST, boundaries),
  DeterministicParser, CommandValidator, ContextResolver, ActionRouter (with fake adapters),
  captureFlowReducer, repositories + migrations on `node:sqlite`.
* Fixtures of real sentences in three languages live in `src/core/__fixtures__/sentences.ts`
  and are used by both the parser tests and the LLM prompt few-shots.
* Platform adapters are thin and are exercised on device (see README manual test plan).

Every phase ends with `npm run typecheck && npm run lint && npm test`.

---

## 11. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Environment, architecture, ADRs | done |
| 2 | Bootstrap Expo SDK 57 project (dev build, Expo Router, strict TS, ESLint, Vitest) | done |
| 3 | Domain models, SQLite migrations, repositories (FTS5), services | done – tested on node:sqlite |
| 4 | Text command input | done |
| 5 | Intent engine (deterministic nl/en/fr, validator, context, LLM parser, thresholds) | done – 151 tests |
| 6 | Voice input (expo-speech-recognition, live transcript, VoiceInputService) | done – device verification pending |
| 7 | Tasks / notes / inbox (screens, search, undo) | done |
| 8 | Calendar / reminders (EventKit, CalendarContract, notification fallback) | done – device verification pending |
| 9 | Alarms / timers (AlarmKit module, AlarmClock intents, fallbacks) | done – Swift/Kotlin not compiled here |
| 10 | App Intents / Siri, Android shortcuts | done – config plugins verified with prebuild |
| 11 | Widgets (Android widget via plugin; iOS WidgetKit + Live Activity sources) | Android done; iOS needs the extension target (documented) |
| 12 | Polish, docs, tests | done – `npm run check` green |
| 13 | AI-Butler (spec §94–§140): admin domain + migration 3, finance engine, email analysis/drafting, projects/meetings/proposals, workflow engine, tool catalog/registry, AdminParser, Butler screens | done – 317+ tests on node:sqlite; device verification pending (see ADMIN.md §8) |

---

## 12. AI-Butler layering (spec §137)

```
Butler screens (src/app/admin/*, (tabs)/admin, settings/business)   ToolResultView (payload → UI)
        │ runTool() (buttons)                                        ▲
        ▼                                                            │
IntentEngine ── AdminParser ─► BUTLER_TOOL command ─► ActionRouter ─► ToolRegistry.execute
        │              (catalog schema + preview)         │             │ focus · audit · undo
        └─ LLMParser (tool from catalog, dates as phrases)│             ▼
                                                          │    tools/*: admin · email · finance · project
                                                          │             ▼
                                                          │    services/admin/*: Company · Invoice · Expense · Timesheet
                                                          │      Document · FollowUp · Email · Project · Meeting
                                                          │      Suggestion · Workflow · Administrative · Audit · Link
                                                          ▼             ▼
                                              platform ButlerAdapters   repositories (SQLite migration 3)
                                              (mailto composer, expo-print PDF, notifications)
```

Rule unchanged: `src/core` never imports the platform. The Butler reaches the mail app, PDF printer and notifications
only through `ButlerAdapters` / `ReminderScheduler` installed by the runtime.
