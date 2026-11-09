# Permissions

Every permission is requested at the moment a feature needs it, with a purpose string that
explains why. Denying a permission never breaks the app: the table lists the fallback.

| Permission | Purpose | Asked when | iOS key / Android permission | If denied |
|---|---|---|---|---|
| Microphone | Listen while you hold/tap the mic | first tap on the mic | `NSMicrophoneUsageDescription` / `RECORD_AUDIO` | Voice disabled, typed commands still work; message with link to Settings |
| Speech recognition | Transcribe with Apple Speech | first tap on the mic (iOS) | `NSSpeechRecognitionUsageDescription` | idem |
| Calendar | Create/read events for the agenda | first calendar command or Today view | `NSCalendarsFullAccessUsageDescription` / `READ_CALENDAR`, `WRITE_CALENDAR` | Calendar commands fail with a clear error; Today shows local mirror only |
| Reminders (iOS) | Create items in Apple Reminders | first reminder command (backend *Apple Reminders*) | `NSRemindersFullAccessUsageDescription` | Reminder saved in BrainVoice + local notification instead (explained in the card) |
| Notifications | Deliver reminders, task alerts, timer/alarm fallbacks | first reminder/timer/task-with-time | `UNUserNotificationCenter` / `POST_NOTIFICATIONS` | Reminder/timer creation fails with an explanation |
| Alarms (iOS 26) | Real AlarmKit alarms and timers | first alarm/timer command | `NSAlarmKitUsageDescription` | Time-sensitive notification instead (explained) |
| Exact alarms (Android) | Deliver reminders/alarms at the exact minute | declared at install (Android 12+ may require confirmation in system settings) | `SCHEDULE_EXACT_ALARM` | Notifications may be delayed by the OS |
| Set alarm (Android) | `AlarmClock.ACTION_SET_ALARM` / `ACTION_SET_TIMER` | install time (normal permission) | `com.android.alarm.permission.SET_ALARM` | Notification fallback |
| Contacts | **Not requested** – people are recognised from what you say, never from your address book | – | `READ_CONTACTS` is explicitly blocked in `app.config.ts` | – |

Permission state and manual grant buttons: Settings → *Calendar, reminders & alarms*.
Implementation: `src/core/commands/adapters.ts` (`PermissionState`), `src/platform/adapters/*`,
`app.config.ts` (usage strings), `plugins/withBrainVoiceIOS.js` (AlarmKit key, App Group).
