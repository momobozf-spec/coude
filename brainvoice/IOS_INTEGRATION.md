# iOS integration

Official frameworks only. Everything native is added through config plugins and a local Expo
module so `ios/` stays generated. Minimum iOS 17; AlarmKit features need iOS 26.

| Feature | Framework | Where |
|---|---|---|
| Speech-to-text | Speech (`SFSpeechRecognizer`) via `expo-speech-recognition` | `src/platform/voice/VoiceInputService.ts` |
| Calendar events | EventKit via `expo-calendar` | `src/platform/adapters/ExpoCalendarAdapter.ts` |
| Reminders | EventKit reminders via `expo-calendar` | `src/platform/adapters/ExpoReminderAdapter.ts` |
| Alarms & timers | **AlarmKit** (iOS 26+) | `modules/brainvoice-native/ios/BrainVoiceNativeModule.swift` |
| Notifications | UserNotifications via `expo-notifications` | `src/platform/adapters/ExpoNotificationAdapter.ts` |
| Siri / Shortcuts / Action Button | App Intents (`AppShortcutsProvider`) | `plugins/ios/BrainVoiceAppIntents.swift` (added to the app target by `plugins/withBrainVoiceIOS.js`) |
| Shared queue app ↔ intents | App Group `group.com.brainvoice.app` | entitlement added by the plugin |
| Widgets / Live Activity | WidgetKit + ActivityKit | `native/ios-widget/` (optional extension target, see below) |
| Secrets | Keychain via `expo-secure-store` | `src/platform/secrets.ts` |

## Speech

`expo-speech-recognition` wraps `SFSpeechRecognizer` with interim results, `addsPunctuation`,
`iosTaskHint: dictation` and `requiresOnDeviceRecognition` (Settings → AI & language). Audio is not
persisted. Locale defaults to the device locale when it matches the chosen language, otherwise
`nl-BE` / `en-GB` / `fr-BE`.

## Calendar & reminders (EventKit)

* Events go to the default calendar (`getDefaultCalendarSync`) or the first writable one; alerts
  (`alarms.relativeOffset`), recurrence rules (`RecurrenceRule`) and time zone are passed through.
  Undo = `event.delete()`.
* Reminders are real Apple Reminders items with an alarm at the due time; completing/deleting from
  BrainVoice updates the item (`ExpoCalendarReminder.update/delete`). If access is denied or the
  user picks *BrainVoice notifications* as backend, a local notification is scheduled instead.
* iOS 17 write-only calendar access is not used: the Today view needs read access.

## AlarmKit (iOS 26)

AlarmKit is the only public way to create Clock-style alarms that ring through Silent mode and
appear on the Lock Screen / Dynamic Island.

* Authorization: `AlarmManager.shared.requestAuthorization()`; Info.plist key
  `NSAlarmKitUsageDescription` (set in `app.config.ts`).
* One-off alarm: `Alarm.Schedule.fixed(date)`; repeating: `.relative(Relative(time:repeats: .weekly([...])))`.
* Timer: `AlarmManager.AlarmConfiguration.timer(duration:attributes:)`.
* Cancel (undo): `AlarmManager.shared.cancel(id:)`.
* On iOS < 26 (or if authorization is denied) the router schedules a time-sensitive local
  notification and says so in the result card (`ALARM_NOT_SUPPORTED` / `ALARM_PERMISSION_DENIED`).
* The countdown UI for timers (Lock Screen / Dynamic Island) requires a Live Activity in a widget
  extension: `native/ios-widget/BrainVoiceAlarmLiveActivity.swift`. Without it the timer still
  fires as an alert.

The Swift module links AlarmKit weakly (`s.weak_frameworks = 'AlarmKit'`) and guards every call
with `#if canImport(AlarmKit)` + `#available(iOS 26.0, *)`, so the app builds with Xcode 26 and
runs on iOS 17+. It could not be compiled on the Windows machine used to write it; if Xcode reports
a signature mismatch for `AlarmAttributes`/`AlarmPresentation`, adjust it against the current
AlarmKit headers – the JS side only depends on the module's function names.

## App Intents & Siri

`BrainVoiceAppIntents.swift` declares:

| Intent | Siri phrase (examples) |
|---|---|
| Capture Thought | "Capture with BrainVoice", "Tell BrainVoice something" |
| Create Task | "Add a task to BrainVoice" |
| Create Reminder | "Remind me with BrainVoice" |
| Add Calendar Event | "Schedule with BrainVoice" |
| Set BrainVoice Alarm | "Wake me with BrainVoice" |
| Ask BrainVoice | "Ask BrainVoice" |
| Open Brain Inbox | "Open my BrainVoice inbox" |

Each intent asks for its text parameter (Siri dialog), appends a record to the App Group
`UserDefaults` queue and opens the app (`openAppWhenRun = true`). On becoming active the JS side
drains the queue (`BrainVoiceNative.consumePendingIntents()` in `src/runtime/integrations.ts`) and
opens the capture screen with the text, so the same preview / confirmation / undo applies.
Phrases are registered automatically (App Shortcuts) – no user setup. The intents also appear in
the Shortcuts app and can be assigned to the **Action Button** (Settings → Action Button → Shortcut).

## Notifications

Categories `reminder`, `task` (actions *Done*, *Snooze 10 min*), `alarm` (*Snooze*), `timer`
(*Open*). Reminder/alarm/timer notifications use `interruptionLevel: timeSensitive`. Critical
alerts are not used (require an Apple entitlement).

## Widgets and Live Activities (optional extension target)

Expo cannot add an app extension target without a third-party plugin, and this project was
built on Windows where the result could not be compiled. The sources are ready in
`native/ios-widget/`:

1. In Xcode: File → New → Target → *Widget Extension*, name `BrainVoiceWidgets`, include Live Activity.
2. Replace the generated Swift files with `BrainVoiceWidgets.swift` and
   `BrainVoiceAlarmLiveActivity.swift`; add `BrainVoiceAlarmMetadata.swift` to **both** targets.
3. Enable the App Group `group.com.brainvoice.app` on the extension; `NSSupportsLiveActivities` is
   already set by the plugin.
4. Because `ios/` is regenerated by prebuild, either keep the target with
   `npx expo prebuild --no-clean`, or manage it with the community plugin
   `@bacons/apple-targets` (documented option, not vendored here).

## Genuine restrictions

* **Apple Notes** has no public write API → notes live in BrainVoice, exportable via the share sheet.
* **No always-on listening** for third-party apps → tap-to-talk, Siri, Action Button, widgets.
* **AlarmKit** is iOS 26+ only → notification fallback below that.
* **Background execution**: intents open the app; nothing runs in the background except scheduled
  notifications delivered by the system.

## Build notes

* Xcode 26+, `npx expo prebuild`, `npx expo run:ios --device`.
* Capabilities: App Groups (added automatically), Push not required.
* Bundle id `com.brainvoice.app` – change in `app.config.ts` together with the App Group id
  in `plugins/withBrainVoiceIOS.js`, `BrainVoiceAppIntents.swift` and the Swift module.
