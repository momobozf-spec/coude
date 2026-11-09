# Android integration

Official APIs only, no background services, no always-listening microphone. Minimum SDK 26,
target/compile SDK 36.

| Feature | API | Where |
|---|---|---|
| Speech-to-text | `android.speech.SpeechRecognizer` via `expo-speech-recognition` | `src/platform/voice/VoiceInputService.ts` |
| Calendar events | Calendar Provider (`CalendarContract`) via `expo-calendar` | `src/platform/adapters/ExpoCalendarAdapter.ts` |
| Reminders | local + `NotificationManager` (no system reminders store) | `src/platform/adapters/ExpoReminderAdapter.ts` (`UnavailableReminderAdapter`) + notifications |
| Alarms | `AlarmClock.ACTION_SET_ALARM` intent (system clock app) | `modules/brainvoice-native/android/.../BrainVoiceNativeModule.kt` |
| Timers | `AlarmClock.ACTION_SET_TIMER` | idem |
| Cancel alarm/timer | `ACTION_DISMISS_ALARM` (label search), `ACTION_DISMISS_TIMER` | idem |
| Notifications | channels + categories via `expo-notifications` | `src/platform/adapters/ExpoNotificationAdapter.ts` |
| App shortcuts | static `res/xml/shortcuts.xml` | `plugins/withBrainVoiceAndroid.js` |
| Home-screen widget | `AppWidgetProvider` | `plugins/android/BrainVoiceWidgetProvider.kt` + plugin |
| Secrets | Keystore via `expo-secure-store` | `src/platform/secrets.ts` |

## Speech

`SpeechRecognizer` with `EXTRA_LANGUAGE_MODEL = free_form`, interim results, 1.5 s end-of-speech
silence. Requires a recognition service (Google app is queried via the config plugin's
`androidSpeechServicePackages`). On Android 13+ the offline model can be forced (*On-device
recognition only*); the app can trigger the model download dialog through the library. Only
`RECORD_AUDIO` is requested.

## Calendar Provider

`expo-calendar` writes through `CalendarContract`. The adapter picks the primary writable
calendar (`isPrimary && allowsModifications`), passes alerts, recurrence and time zone, and deletes
the event on undo. Permissions: `READ_CALENDAR`, `WRITE_CALENDAR` (runtime, requested on first use).

## Alarms and timers (AlarmClock intents)

Android does not let third-party apps create alarms inside the clock app except through the
documented `android.provider.AlarmClock` intents:

* `ACTION_SET_ALARM` with `EXTRA_HOUR`, `EXTRA_MINUTES`, `EXTRA_MESSAGE`, `EXTRA_DAYS`
  (repeat weekdays), `EXTRA_SKIP_UI = true`, `EXTRA_VIBRATE`.
* `ACTION_SET_TIMER` with `EXTRA_LENGTH` (seconds), `EXTRA_MESSAGE`, `EXTRA_SKIP_UI`.
* `ACTION_DISMISS_ALARM` + `ALARM_SEARCH_MODE_LABEL` for undo (best effort – behaviour depends
  on the clock app); `ACTION_DISMISS_TIMER` for timers.
* Requires `com.android.alarm.permission.SET_ALARM` (install-time) and `<queries>` for package
  visibility on Android 11+ (declared in the module manifest and by the plugin).

**Limitation:** the intent takes a time and optional repeat days, never a calendar date. The
`ActionRouter` therefore:

1. sets the clock-app alarm only when the requested moment is the *next* occurrence of that time
   (e.g. "tomorrow 06:30" said today) or when it repeats;
2. always adds a time-sensitive notification at the exact moment as a safety net;
3. for alarms further in the future, schedules only the notification and explains why in the
   result card.

No `AlarmManager` exact alarms are used for arbitrary background work; `SCHEDULE_EXACT_ALARM` is
declared only so that reminder and alarm notifications fire at the exact minute (the OS may ask the
user to confirm on Android 12+).

## Notifications

Channels: `reminders` (HIGH), `alarms` (MAX), `timers` (MAX), `tasks` (DEFAULT). Actions *Done* /
*Snooze 10 min* on reminder and task notifications, handled in `src/runtime/integrations.ts`.
`POST_NOTIFICATIONS` is requested on first use (Android 13+).

## App shortcuts

Long-press the launcher icon: *Capture*, *Task*, *Reminder*, *Inbox*. Each is a deep link
(`brainvoice://capture?source=shortcut&kind=task`, `brainvoice://inbox`) handled by Expo Router
(`src/app/capture.tsx`). Generated into `res/xml/shortcuts.xml` by the plugin. Dynamic/pinned
shortcuts can be added later with `ShortcutManagerCompat`.

## Widget

`BrainVoiceWidgetProvider` renders a "Tap to capture" RemoteViews button whose PendingIntent opens
`brainvoice://capture?source=widget`, which starts listening immediately. Registered in the
manifest (`APPWIDGET_UPDATE` receiver + `@xml/brainvoice_widget_info`) by the plugin.

## Background & battery

* No foreground/background services, no wake locks, no always-on microphone.
* All timing is delegated to the system: clock app (alarms/timers) and `NotificationManager`
  (scheduled notifications via `expo-notifications`).
* Nothing runs when the app is closed except system-delivered notifications.

## Build notes

* `npx expo prebuild && npx expo run:android` (JDK 17, SDK 36, Kotlin from Expo's gradle plugin).
* Package `com.brainvoice.app` – the plugin derives shortcut targets and the widget package from
  `android.package`; change it only in `app.config.ts`.
* The Kotlin module was written on Windows without an Android SDK; it uses only stable
  `android.provider.AlarmClock` constants and the Expo Modules API and should compile as is.
