import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

/**
 * JS binding for the local Expo module `BrainVoiceNative`.
 *
 * iOS  → ios/BrainVoiceNativeModule.swift   (AlarmKit alarms/timers, App Intents queue)
 * Android → android/…/BrainVoiceNativeModule.kt (AlarmClock intents)
 *
 * Both platforms expose the same surface; unsupported calls return `false` /
 * `'unavailable'` or throw, and the adapters translate that into fallbacks.
 * The module is `null` in environments where it is not linked (web, Expo Go).
 */

export interface AlarmScheduleOptions {
  localId: string;
  /** Absolute moment (ISO 8601 with offset) for one-off alarms. */
  fireISO: string;
  hour: number;
  minute: number;
  label: string;
  /** ISO weekdays (1 = Monday … 7 = Sunday) for repeating alarms; empty for one-off. */
  repeatWeekdays: number[];
}

export interface TimerScheduleOptions {
  localId: string;
  seconds: number;
  label: string;
}

export interface ClockAlarmOptions {
  hour: number;
  minute: number;
  label: string;
  /** java.util.Calendar weekdays (Sunday = 1 … Saturday = 7). */
  days: number[];
  skipUi: boolean;
}

export interface ClockTimerOptions {
  seconds: number;
  label: string;
  skipUi: boolean;
}

export interface PendingIntent {
  id: string;
  kind: 'capture' | 'task' | 'reminder' | 'event' | 'alarm' | 'ask' | 'open_inbox';
  text: string | null;
  createdAt: string;
}

export type AlarmAuthorization = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type BrainVoiceNativeModuleType = NativeModule<Record<never, never>> & {
  isAlarmKitAvailable(): boolean;
  getAlarmAuthorizationStatus(): Promise<AlarmAuthorization>;
  requestAlarmAuthorization(): Promise<AlarmAuthorization>;
  scheduleAlarm(options: AlarmScheduleOptions): Promise<{ externalId: string; backend: string }>;
  scheduleTimer(options: TimerScheduleOptions): Promise<{ externalId: string; backend: string }>;
  cancelAlarm(externalId: string): Promise<boolean>;
  hasClockApp(): boolean;
  setClockAlarm(options: ClockAlarmOptions): Promise<boolean>;
  setClockTimer(options: ClockTimerOptions): Promise<boolean>;
  dismissClockAlarm(label: string): Promise<boolean>;
  dismissClockTimer(): Promise<boolean>;
  showClockAlarms(): Promise<boolean>;
  consumePendingIntents(): PendingIntent[];
};

export const BrainVoiceNative = requireOptionalNativeModule<BrainVoiceNativeModuleType>('BrainVoiceNative');
