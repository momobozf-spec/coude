# Privacy

BrainVoice handles very personal data: what you think, plan and worry about. These are the rules
the code follows. Every statement below maps to code that is tested or reviewable.

## Local-first

* All data lives in an SQLite database on the device (`brainvoice.db`, app sandbox). There is no
  account, no server, no telemetry, no crash reporting service.
* Optional cloud synchronisation is only an interface (`src/core/sync/SyncAdapter.ts`); nothing
  is implemented or enabled.
* *Settings → Privacy → Erase all data* deletes every row (`eraseAllData`). Calendar events,
  reminders and alarms already created in the system apps remain there – they belong to you.

## Audio and transcripts

* Raw audio is **never** written to disk. `expo-speech-recognition` is started with
  `recordingOptions.persist = false` (`src/platform/voice/VoiceInputService.ts`).
* The microphone only runs after you tap the button and stops when the recogniser ends or you tap
  again. The OS microphone indicator is visible the whole time. There is no background listening
  and no wake-word (ARCHITECTURE.md §8).
* Transcripts (the recognised words) are stored with each capture so that you can search them.
  Switch *Keep transcripts* off in Settings → Privacy to store only the interpreted result; you can
  also delete any capture.

## Speech recognition provider

Speech-to-text uses the platform recogniser: Apple Speech (`SFSpeechRecognizer`) on iOS and
`android.speech.SpeechRecognizer` (Google / Samsung service) on Android. Depending on device
settings the audio may be processed on the vendor's servers. *On-device recognition only* in
Settings → AI & language forces the offline model when the device supports it.

## Cloud AI

* Off by default. Two switches must be on: Settings → AI & language → *Use cloud AI* **and**
  Settings → Privacy → *Cloud AI interpretation* (consent).
* When on, and only when the built-in parser is unsure, the app sends: the text of the command
  you just said, the current date/time and timezone, your category names, and – for follow-ups –
  the pending question and a one-line summary of the last command. It never sends your calendar,
  notes, tasks, contacts, history or transcripts in bulk (`src/core/ai/prompts.ts`).
* The model never decides dates on its own: every date phrase is re-resolved locally, and
  implausible hints are rejected (`src/core/intent/LLMParser.ts`).
* Provider: Anthropic (Claude) through either the BrainVoice proxy you host (`proxy/`) or your own
  API key. The `AIProvider` interface allows other providers or an on-device model later.

## Secrets

API keys and proxy tokens are stored with `expo-secure-store` (iOS Keychain / Android Keystore),
accessible only when the device is unlocked, never in SQLite, logs or git (`src/platform/secrets.ts`).
`.env` files are git-ignored; only `EXPO_PUBLIC_*` values (non-secret) are read at build time.

## Permissions

Requested lazily, only when a feature needs them (see PERMISSIONS.md). A denied permission never
blocks the app: the closest legitimate alternative is used and explained in the result card.

## Logs

Diagnostics logs (Settings → Diagnostics) contain error codes, timings and item ids, not the text
you spoke. They stay in memory and are only shared if you tap *Copy*.

## Administrative data (AI-Butler, spec §134–§136)

* Emails you import, invoices, time entries, expenses, documents, projects and meeting notes are stored in the same local SQLite database as your notes; nothing leaves the phone unless cloud AI is enabled or you confirm sending an email.
* With cloud AI enabled, the Butler sends only what a request needs (one email body, one receipt photo, one set of meeting notes), wrapped as untrusted content with explicit rules; never your whole mailbox, database or contacts.
* Sensitive and external actions (issuing invoices, marking them paid, recording incoming invoices, sending email) always show a confirmation card first and are written to the audit log (Settings → Business profile → Audit log), which stores the tool name, a short argument summary and a hash – not email bodies or amounts.
* Erase all data removes the administrative tables as well; the built-in automation definitions remain.
