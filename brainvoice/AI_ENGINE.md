# AI engine

How natural language becomes a validated, executable command. All of this is in `src/core`
(pure TypeScript, unit-tested) and never touches iOS/Android APIs.

```
text/transcript
  └─ IntentEngine.process()                         src/core/intent/IntentEngine.ts
       1 language detection (nl/en/fr, device prior) LanguageDetector.ts
       2 ContextResolver – clarification answers,    ContextResolver.ts
         "make that 3 instead"
       3 DeterministicParser                         DeterministicParser.ts + triggers.ts
       4 LLMParser (optional, unsure only)           LLMParser.ts + ai/*
       5 CommandValidator                            CommandValidator.ts
       6 decision: execute | confirm | clarify | unknown
  └─ ActionRouter.execute(batch)                     src/core/commands/ActionRouter.ts
       adapters (calendar, reminders, alarms, timers, notifications) + services
       history entry with undo plan
```

## The contract: `CommandSchema`

`src/core/intent/schema.ts` defines a Zod discriminated union of 15 intents:

`CAPTURE_NOTE, CAPTURE_IDEA, CREATE_TASK, CREATE_REMINDER, CREATE_CALENDAR_EVENT, CREATE_ALARM,
CREATE_TIMER, UPDATE_TASK, COMPLETE_TASK, UPDATE_EVENT, DELETE_EVENT, SEARCH_NOTES, GET_AGENDA,
GET_TASKS, UNKNOWN`

Every command carries `confidence`, `language`, `originalText`, `requiresConfirmation`,
`missingFields`, `clarificationQuestion`, `parser` (`deterministic | llm | context | manual`) and
`warnings`. Dates are a `When` object: resolved `date` / `time` / `iso` in the device zone plus
`hasExplicitDate` / `hasExplicitTime`, `recurrence` and the original `phrase`. The UI, the validator
and the router only ever see this shape; nothing unvalidated is executed.

## Deterministic parser (offline, first)

* Sentences are split on `. ! ?`; inside a sentence, strong triggers after `,` / `and|en|et`
  start a new clause ("remind me at nine…, add gym… and note that…" → 3 commands). A leading
  date phrase ("Tomorrow …") is shared by clauses without their own date.
* Per language, ordered regex triggers (`triggers.ts`) classify a clause: timer, alarm, reminder,
  calendar event, complete/update/delete, search, agenda, tasks, idea, note, task, imperative verbs.
* The date phrase is removed with `DateResolver.extract`, the trigger is stripped, the title is
  cleaned (fillers, "in my calendar", Dutch "om X te bellen" → "X bellen", French "d'appeler"),
  proper-noun casing is restored from the original text, people and locations are extracted.
* Task lists ("buy milk, go to the pharmacy and call Youssef") become several tasks when every
  item has ≥ 2 words. "Remind me 30 minutes beforehand" after an event becomes an alert on it.
* Notes/ideas keep the full content (dates inside are content, not schedule). "I just had an idea.
  An app for…" merges the next sentence into the idea.
* Anything unrecognised becomes a low-confidence note (thought) so nothing is lost; with cloud AI
  enabled the LLM gets a chance first.

## DateResolver

`src/core/date/DateResolver.ts` + `lexicon.ts`. Luxon with an explicit IANA zone; tested for
Europe/Brussels DST transitions, month/year boundaries, midnight and America/New_York.

Policies (documented decisions):

* **`next Monday`** = Monday of next ISO week; **`this Friday`** / bare weekday = the coming
  occurrence (today counts if the time is still ahead).
* Ambiguous hours without am/pm: **business** policy → 1–6 = afternoon (13–18), 7–12 as said;
  **morning** policy for alarms (6:30 = 06:30). Day parts override ("7 in the evening" = 19:00).
* Dutch **"half zeven" = 06:30**, "kwart voor acht" = 07:45; French "14h", "et demie",
  "moins le quart"; English "quarter past six", "around 4 PM".
* Day parts without a time use defaults (morning 09:00, afternoon 14:00, evening 20:00) and are
  flagged `hasExplicitTime = false` → the validator warns and asks for confirmation.
* Time-only phrases ("at 8") resolve to today if still ahead, otherwise tomorrow. Searches use
  `preferFuture = false` ("yesterday", "last week" become ranges).
* Recurrence: "every Monday", "elke werkdag", "tous les lundis", "first Monday of next month".

## Validation & thresholds

`CommandValidator` adds issues per intent: missing title/date/time/duration/target, past dates,
end before start, invalid dates, destructive intents, low confidence. Errors become
`missingFields` + a localized `clarificationQuestion`; warnings force confirmation.

Decision (`EngineConfig`, user-configurable in Settings):

| confidence | result |
|---|---|
| ≥ `autoConfirm` (0.90) and safe intent and "execute immediately" enabled | `execute` (no card) |
| ≥ `confirm` (0.65) | `confirm` – show cards, wait for Confirm |
| < 0.65 or missing required field | `clarify` – ask one question |

Destructive intents (`DELETE_EVENT`, `UPDATE_*`, `COMPLETE_TASK`) always require confirmation.

## Conversation context

`ConversationState` (persisted in SQLite) holds the pending clarification and the last proposed
or executed batch (TTL 10 min). "Friday morning" answers "When?"; "at 3" fills a missing time;
"Make that 3 instead" / "Doe dat maar om 3 uur" / "Plutôt 15h" modifies the last command. If that
batch was already executed, the runtime undoes it before executing the modified version.

## LLM parser (optional)

* `AIProvider` interface (`parseCommand`, `summarize`, `classify`, `extractEntities`).
  `AnthropicProvider` calls the Messages API (`POST /v1/messages`) with **structured output**
  (`output_config.format = json_schema` generated from the Zod schema) and validates the reply with
  Zod again. Model default `claude-opus-5`, `effort: low` for latency; `claude-sonnet-5` and
  `claude-haiku-4-5` selectable.
* The model returns date **phrases**, never absolute dates; `LLMParser` resolves them with the
  `DateResolver`. ISO hints are accepted only if local resolution fails and the hint is plausible
  (not in the past, < 2 years ahead) – and then the command is marked `LLM_DATE_HINT` with reduced
  confidence.
* Used only when the deterministic result is unsure (`< llmFallbackBelow` or fallback note) and
  the device is online. Failures degrade to the deterministic result; offline free text is queued
  in the Brain Inbox (`outbox` table) for review.
* Transport: BrainVoice proxy (`proxy/`, holds the API key, bearer token per device) or a user key
  from the keychain. No key is ever in the app bundle or repo.

## Butler tools (spec §132, §137–§138)

Administrative and project-management requests become a `BUTLER_TOOL` command:
`{ tool, args, permission, preview }` where `tool` is a name from `src/core/butler/catalog.ts` and `args` was validated
against that tool's Zod schema.

* `AdminParser` (`src/core/butler/AdminParser.ts`) runs **before** the capture parser with ordered regex rules per
  language. Rules that need context ("stuur", "maak het professioneler", "dit was voor project X") only fire when the
  conversation **focus** holds the right entity. Missing information produces a clarification ("Wat moet ik
  factureren?") that `AdminParser.complete` fills with the next answer.
* The LLM may return `intent: BUTLER_TOOL` with `tool` + `toolArgs`; the catalog is listed in the system prompt. Date
  arguments are phrases in keys ending with `Phrase` and are resolved locally; arguments are validated again, so an
  invalid tool call degrades to `UNKNOWN`.
* `CommandValidator` adds `CONFIRM_REQUIRED` for `sensitive`/`external` tools; the engine only auto-executes `read`
  tools (and only when the user enabled auto-execution).
* `AIGateway.structured()` is the single door for the administrative services to the model (email analysis, reply
  drafting, meeting extraction, invoice/receipt reading with images). Every result is validated with Zod; third-party
  content is wrapped in `<untrusted_*>` tags (`src/core/butler/safety.ts`). All of these have a deterministic path when
  the provider is off.

## Adding a language

1. Add a `Lexicon` in `src/core/date/lexicon.ts` (weekdays, months, numbers, day parts, words).
2. Add trigger rules, fillers, connectors in `src/core/intent/triggers.ts`.
3. Add strings in `src/core/i18n/strings.ts`, `src/core/errors/messages.ts`, `src/ui/i18n.ts`.
4. Add markers in `LanguageDetector.ts`, fixtures in `src/core/__fixtures__/sentences.ts`, run `npm test`.

Right-to-left scripts (Arabic) need `LETTER` in `src/core/util/text.ts` extended to `\p{L}`.

## Tests

`npm test` runs 177 tests: `DateResolver` (43), parser fixtures in three languages (84),
engine decisions / context / LLM fallback (19), Anthropic provider wire format (5), repositories
and services on a real SQLite (6), router + undo vertical slice (15), flow reducer (5).
