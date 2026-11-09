# BrainVoice

A voice-operated second brain and command center for iPhone and Android.

Tap one microphone button and say what is on your mind. BrainVoice transcribes it,
understands whether it is a note, an idea, a task, a reminder, a calendar event,
an alarm, a timer or a question, shows you what it is about to do, and executes it
against the real device features (calendar, reminders, alarms, notifications) or
its own local Brain Inbox. Every action can be undone.

```
"Remind me tomorrow at 8 to call Yakup."      → Reminder · Call Yakup · Tomorrow 08:00
"I have an idea for a halal product scanner." → Idea in the Brain Inbox (category Business)
"Put a meeting with Fabrice Friday at 2."     → Calendar event Fri 14:00–15:00 (device calendar)
"Wake me tomorrow at 6:30."                   → AlarmKit alarm (iOS 26) / clock app alarm (Android)
"What do I need to do tomorrow?"              → Tasks for tomorrow
"What did I say about my Bol.com idea?"       → Full-text search across your notes
```

Dutch, English and French are supported; the architecture allows adding Arabic later.

Since October 2026 the same conversation also runs the **AI-Butler**, a personal administrative assistant and
lightweight project manager (spec §94–§140, see `ADMIN.md`):

```
"Wat moet ik vandaag doen?"                                   → daily plan with factual reasons
"Welke mails moet ik nog beantwoorden?"                       → emails that need an answer
"Open de laatste mail van Fabrice." … "Antwoord dat ik dit morgen bekijk." … "Stuur."
"Maak een factuur voor klant GO! voor 5 werkdagen aan €750 per dag." → preview, number, PDF
"Noteer 8 uur voor project Dashboard vandaag." / "Maak mijn factuur voor september."
"Meeting met Sven is gedaan. Hij gaat de toegang regelen. …"  → proposals you approve
"Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum." → automation
```

---

## Status

| MVP requirement (spec §34) | Status |
|---|---|
| Transcribe speech (live interim results) | Done – `expo-speech-recognition` (Apple Speech / Android SpeechRecognizer) |
| Understand the command | Done – deterministic parser (nl/en/fr) + optional Claude fallback |
| Identify "tomorrow" correctly | Done – `DateResolver`, device timezone, DST-tested |
| Show the proposed action, edit before executing | Done – action cards with inline edit, stacks for multi-command input |
| Create the reminder after confirmation | Done – Apple Reminders (EventKit) on iOS, notification on Android |
| Show success | Done |
| Undo | Done – every executed command has an undo plan incl. the native item |
| Idea stored in the Brain Inbox | Done |
| Real device calendar item | Done – EventKit / CalendarContract via `expo-calendar` |
| Real alarm | Done – AlarmKit on iOS 26+, `AlarmClock.ACTION_SET_ALARM` on Android, notification fallback elsewhere |
| Butler: email triage, contextual reply drafting, send with confirmation (§95–§97) | Done – local email store (paste/share); Gmail/IMAP adapter is the next seam |
| Butler: invoices in/out, deterministic engine, transactional numbering, PDF (§99–§104) | Done – PDF via expo-print (device verification pending) |
| Butler: clients, profile, timesheets, expenses, documents, follow-ups (§105–§111) | Done – receipt photos need cloud AI; pasted text works offline |
| Butler: projects, blockers, risks, decisions, meetings → proposals, daily plan, weekly review (§112–§127) | Done |
| Butler: workflow engine, recurring administration, dashboard, typed tool catalog with permissions & audit (§128–§138) | Done |

What was verified on this development machine (Windows, no Xcode/Android SDK):
`npm run check` (strict TypeScript, ESLint, 177 Vitest tests incl. repositories on a real SQLite
engine and the full text → intent → router → undo slice with fake adapters) and
`npx expo prebuild` for both platforms (config plugins generate the native projects).
Native code (Swift/Kotlin) and on-device behaviour must be verified on a Mac / physical devices;
see "What needs a physical device" below.

---

## Requirements

* Node 20 or newer (24 used here), npm
* **iOS**: macOS with Xcode 26 or newer (AlarmKit needs the iOS 26 SDK; the app runs on iOS 17+),
  CocoaPods, an Apple Developer account for device builds (App Groups capability)
* **Android**: Android Studio with SDK 36, JDK 17, an emulator or device on Android 8+
* This is an Expo **development build** project: Expo Go cannot run it (native modules).

---

## Setup

```bash
git clone <repo>
cd brainvoice
npm install
npx expo prebuild        # generates ios/ and android/ from app.config.ts + plugins/
```

`ios/` and `android/` are generated and git-ignored (Continuous Native Generation).
Never edit them by hand; change `app.config.ts`, `plugins/` or `modules/` and run
`npx expo prebuild --clean` again.

---

## Running

### iOS simulator

```bash
npx expo run:ios
```

Works for: text commands, notes, tasks, calendar (the simulator has a calendar), reminders
(simulator Reminders app), notifications, the full UI. Speech recognition on the simulator is
unreliable (no real microphone) and AlarmKit alarms do not ring on the simulator.

### Physical iPhone

```bash
npx expo run:ios --device
```

1. In Xcode (once): select your team under *Signing & Capabilities* for the `BrainVoice` target.
   The App Group `group.com.brainvoice.app` and the Info.plist keys are added by
   `plugins/withBrainVoiceIOS.js`; make sure the App Group exists in your developer account
   (Xcode creates it when you enable the capability).
2. Trust the developer certificate on the phone (Settings → General → VPN & Device Management).
3. Siri: after the first launch, "Hey Siri, capture with BrainVoice" works without setup
   (App Shortcuts). Add "Capture Thought" to the Action Button via Settings → Action Button → Shortcut.

### Android emulator

```bash
npx expo run:android
```

Use an emulator image with Google APIs (speech recognition needs the Google app). The emulator
has a clock app, so `ACTION_SET_ALARM` works; use the emulator's microphone passthrough for voice.

### Physical Android phone

```bash
npx expo run:android --device
```

Enable developer mode + USB debugging. Speech recognition uses the Google app (or Samsung Bixby)
speech service. Long-press the launcher icon for the app shortcuts; add the widget from the
launcher's widget picker.

### Cloud builds (no Mac / Android Studio)

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

`eas.json` defines `development`, `preview` and `production` profiles.

---

## What needs a physical device

| Capability | Simulator/emulator | Physical device |
|---|---|---|
| Speech recognition | unreliable / needs host mic passthrough | yes |
| Siri / App Shortcuts / Action Button | partly (Shortcuts app) | yes |
| AlarmKit alarms & timers ringing | no | iPhone on iOS 26+ |
| Android clock-app alarms | emulator OK | yes |
| Notifications with actions | yes | yes |
| Haptics | no | yes |
| Widgets | Android: yes; iOS: needs the extension target (see IOS_INTEGRATION.md) | yes |

---

## Scripts

```bash
npm run check          # typecheck + lint + tests (run this before every commit)
npm run typecheck
npm run lint
npm test               # vitest (src/core + runtime reducers)
npm run test:coverage
npm run prebuild       # regenerate native projects
npm run doctor         # expo-doctor
```

---

## Project structure

```
app.config.ts           Expo config (permissions, plugins, scheme brainvoice://)
plugins/                Config plugins: App Intents (Swift), App Group, Android shortcuts + widget
modules/brainvoice-native   Local Expo module: AlarmKit (Swift) and AlarmClock intents (Kotlin)
native/ios-widget       WidgetKit + AlarmKit Live Activity sources (optional extension target)
proxy/                  Node proxy that holds the Anthropic API key (optional cloud AI)
src/
  core/                 Pure TypeScript domain (no React Native imports – enforced by ESLint)
    intent/             IntentEngine, DeterministicParser, LLMParser, validator, context, schema
    date/               DateResolver (nl/en/fr) + formatting
    commands/           ActionRouter, adapter interfaces, undo plans
    db/                 SqlDriver, migrations, repositories (FTS5 search)
    services/           Capture, Note, Task, Event, Reminder, Alarm, Agenda, Search, History, Settings
    ai/                 AIProvider abstraction, AnthropicProvider, AIGateway (structured requests), prompts
    flow/               captureFlowReducer (IDLE → LISTENING → … → DONE)
    butler/             Tool catalog, ToolRegistry, AdminParser (nl/en/fr admin commands), focus, safety, tools/
    services/admin/     Company, Invoice, Expense, Timesheet, Document, FollowUp, Email, Project, Meeting,
                        Suggestion, Workflow, Administrative (inbox / daily plan / weekly review), Audit, Link
    finance/            Money (cents), InvoiceEngine, invoice HTML, IBAN/OGM checks, invoice & receipt extraction
    email/              Email analysis (classification, deadlines, commitments), drafting, EmailAdapter contracts
    meetings/, workflow/  Notes/speech → proposals; natural-language automations & recurring administration
    admin/              Read-model types (inbox items, daily plan, project overview, weekly review)
  platform/             Expo/React Native implementations of the adapters, SQLite driver, voice input
  runtime/              Composition root, zustand stores, hooks, OS integrations
  app/                  Expo Router screens (Home, Today, Inbox, Notes, Settings, capture modal…)
  features/, ui/        Components and design tokens
```

Read `ADMIN.md` for the Butler (administrative assistant & project manager, spec §94–§140),
`ARCHITECTURE.md` for the decision record, `AI_ENGINE.md` for the intent pipeline,
`IOS_INTEGRATION.md` / `ANDROID_INTEGRATION.md` for platform details, `PERMISSIONS.md` and
`PRIVACY.md` for data handling.

---

## Cloud AI (optional)

BrainVoice works fully offline with its deterministic parser. For long-tail phrasing you can
enable Claude:

1. **Recommended:** deploy `proxy/` (holds the Anthropic key server-side), then in the app go to
   Settings → AI & language, choose *BrainVoice proxy*, enter the URL and the access token.
2. **Or:** choose *My own Anthropic API key* and paste a key. It is stored in the device keychain
   (never in the database, never in git).

Cloud AI also requires the explicit consent switch in Settings → Privacy. Only the text of the
command you just said is sent.

---

## Manual test plan (on a device)

1. Tap the mic, say **"Remind me tomorrow at 8 to call Yakup."** → card *Reminder · Call Yakup ·
   Tomorrow · 08:00* → Confirm → iOS: item appears in Apple Reminders; Android: notification
   scheduled → tap **Undo** → item gone.
2. **"I have an idea for a halal product scanning app."** → *Idea* card → Confirm → Inbox and Notes
   show it, category *Business*, searchable.
3. **"Put a meeting with Fabrice Friday at 2 in my calendar."** → calendar permission prompt →
   event Friday 14:00–15:00 in the device calendar → Undo removes it.
4. **"Wake me tomorrow at 6:30."** → iOS 26: AlarmKit permission prompt, alarm listed in the system;
   iOS < 26: time-sensitive notification with an explanatory note; Android: clock app alarm
   06:30 + safety notification.
5. **"Set a timer for 25 minutes."** → AlarmKit timer / clock timer / in-app countdown.
6. **"Tomorrow I need to buy milk, go to the pharmacy and call Youssef."** → three task cards.
7. **"Remind me to send the invoice."** → *When should I remind you?* → say **"Friday morning"**.
8. **"Schedule a meeting with Youssef tomorrow at 2."** then **"Make that 3 instead."**
9. **"What do I need to do tomorrow?"**, **"What did I say about my Bol.com idea?"**
10. Same sentences in Dutch and French (see `src/core/__fixtures__/sentences.ts`).
11. Airplane mode + cloud AI enabled: a free-text sentence lands in the Inbox as *unprocessed*
    with a *Review* button.
12. Butler tab → Business profile: fill in company name, VAT number, IBAN and address. Then say
    **"Maak een factuur voor klant GO! voor 5 werkdagen aan €750 per dag."** → preview card with
    3 750 excl. / 787,50 btw / 4 537,50 → Confirm → draft; say **"Maak de pdf."** → confirmation card →
    invoice 2026-001 with structured communication, PDF in the share sheet.
13. Butler tab → Email → paste a mail from "Fabrice" asking for something by Friday. Say
    **"Open de laatste mail van Fabrice."**, **"Wat wil hij van mij?"**, **"Antwoord dat ik dit morgen bekijk."**,
    **"Maak het iets professioneler."**, **"Stuur."** → the final card shows the full draft; Confirm opens the mail app.
14. Say **"Meeting met Sven is gedaan. Hij gaat de toegang regelen. Ik moet tegen vrijdag de dashboardaanpassing
    doen."** → proposals (task + waiting-for) → **"Keur alles goed."** → task due Friday, waiting item for Sven;
    **"Waar wacht ik nog op?"**.
15. **"Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum."** then paste an invoice text with a
    due date in Email → *Proposals* → record it → a reminder three days before the due date appears.

---

## Troubleshooting

* **"Speech recognition unavailable"** – on Android install/enable the Google app; on iOS enable
  Siri & Dictation. On-device recognition needs the language pack (Settings → AI & language).
* **Calendar event not created** – grant calendar access (Settings → Calendar, reminders & alarms).
* **AlarmKit authorization error** – requires iOS 26 and Xcode 26 SDK; older devices fall back to
  notifications automatically.
* **Prebuild fails on a plugin** – run `npx expo prebuild --clean` and check `plugins/*.js`.
* **Database error at start** – the app refuses to run on a failed migration and keeps your data;
  check Settings → Diagnostics logs and open an issue with the migration version.


## Alfred – 24/7 operations layer (spec §141–§181)

On top of the Butler, Alfred turns requests into **durable tickets** that background workers
process through the same tool registry, permission levels, approvals and audit log as the
interactive commands. Nothing important happens without approval: sensitive and external steps
(sending, invoicing, device actions) always become an approval card with WHAT / WHY / SOURCE /
IMPACT / CONTENT.

* **Mission Control** – Butler tab → Mission Control (`/ops`): inbox, queue, working, waiting,
  blocked, scheduled, completed, failed, approvals, questions, projects, team activity, system
  health, briefings, schedules, failed jobs. See `docs/MISSION-CONTROL.md`.
* **Where it runs** – inside the app while it is open (`Settings → Alfred → Run workers inside
  the app`, never 24/7) or on the Node server in `server/` (`npm run dev`, Docker). System Health
  only reports 24/7 when a server-mode worker is alive. See `docs/DEPLOYMENT.md` and
  `docs/BACKGROUND-JOBS.md`.
* **Email monitoring** – every 15 minutes through an `EmailProvider`; today only the local
  store (paste/share) is implemented, Gmail and Microsoft 365 are seams that require credentials.
  Triage classifies mail, proposes records and opens tickets; email text is never an instruction.
* **Briefings** – morning briefing (08:00), evening review (18:00) and night-shift report built
  from actual state; delivered in-app, optionally by push (server) or email (provider that can send).
* **Automations** – "Elke maandag om 9u: geef me de open facturen" becomes a schedule that creates
  a ticket; cron, interval, daily, weekly and one-time schedules are timezone-aware.
* **CRM & quotes** – interactions, timelines, silent-client proposals, quotes that convert into
  invoice drafts (deterministic amounts, transactional numbering).
* **Advisory board, software engineer, home automation** – see `docs/ADVISORY-BOARD.md`;
  the engineer role only has bounded repo tools (no shell); home automation needs a connected
  provider and classifies devices LOW/MEDIUM/HIGH for safety.

Scripts: `npm run dev` (API + workers + scheduler), `npm run worker`, `npm run scheduler`,
`npm run check` (tsc + eslint + vitest).

### Connected mode, PostgreSQL and Gmail (October 2026)

* **Connected mode**: set the server URL + token in Settings → Alfred and the phone becomes a
  client of Alfred – commands, Mission Control and administrative screens use the server; notes,
  tasks, alarms and calendar stay on the device. No local workers run in this mode.
* **PostgreSQL** for production (`DATABASE_URL`), verified with concurrent workers
  (`npm run test:pg`); SQLite stays for local development and tests.
* **Workflow approvals**: `require_approval` steps now create real approval cards and resume the
  run after approval, also after a restart.
* **Gmail** behind the `EmailProvider` seam: OAuth consent from the app, tokens encrypted on the
  server, polling every 15 minutes, replies prepared as approval cards, sending only after approval
  (tested against Gmail-shaped payloads; a real mailbox needs Google OAuth credentials).
* **Hardening**: readiness endpoint, rate limiting, optional TLS, JSON logs, scheduler heartbeat.
  See `docs/DEPLOYMENT.md` for the honest status of each piece.
