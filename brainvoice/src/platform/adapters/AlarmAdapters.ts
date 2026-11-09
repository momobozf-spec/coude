import { Platform } from 'react-native';

import type { AlarmAdapter, AlarmCapabilities, AlarmInput, AlarmRecord, PermissionState, TimerAdapter, TimerInput } from '@core/commands/adapters';
import { DomainError, type Language } from '@core/types/common';
import { BrainVoiceNative } from '@platform/native/BrainVoiceNative';

/**
 * Alarm / timer adapters.
 *
 *  iOS 26+   → AlarmKit through the local `brainvoice-native` Expo module (real Clock-style alarms)
 *  iOS < 26  → `UnsupportedAlarmAdapter`: the router schedules a time-sensitive notification instead
 *  Android   → `AlarmClock.ACTION_SET_ALARM` / `ACTION_SET_TIMER` intents (system clock app); the
 *              router adds a notification safety net because the intent cannot target a date
 */

const ANDROID_LIMITATION: Record<Language, string> = {
  en: 'The Android clock app stores a time, not a date. One-off alarms are set for the next occurrence and BrainVoice adds a notification as safety net.',
  nl: 'De Android klok-app bewaart een tijdstip, geen datum. Eenmalige wekkers worden voor de eerstvolgende keer gezet; BrainVoice voegt een melding toe als vangnet.',
  fr: 'L’app Horloge Android enregistre une heure, pas une date. Les alarmes uniques sont réglées pour la prochaine occurrence et BrainVoice ajoute une notification de sécurité.',
};

/** ISO weekday (1 = Monday … 7 = Sunday) → java.util.Calendar constants (Sunday = 1 … Saturday = 7). */
function toJavaWeekday(iso: number): number {
  return iso === 7 ? 1 : iso + 1;
}

export class AlarmKitAlarmAdapter implements AlarmAdapter {
  readonly id = 'ios-alarmkit';

  async capabilities(): Promise<AlarmCapabilities> {
    return { backend: 'alarmkit', supportsExactDate: true, supportsCancel: true, supportsRecurrence: true, limitationNote: null };
  }

  async getPermission(): Promise<PermissionState> {
    if (!BrainVoiceNative) return 'unavailable';
    return BrainVoiceNative.getAlarmAuthorizationStatus();
  }

  async requestPermission(): Promise<PermissionState> {
    if (!BrainVoiceNative) return 'unavailable';
    return BrainVoiceNative.requestAlarmAuthorization();
  }

  async setAlarm(input: AlarmInput): Promise<AlarmRecord> {
    if (!BrainVoiceNative) throw new DomainError('ALARM_NOT_SUPPORTED');
    try {
      const result = await BrainVoiceNative.scheduleAlarm({
        localId: input.localId,
        fireISO: input.fireISO,
        hour: input.hour,
        minute: input.minute,
        label: input.label ?? 'Alarm',
        repeatWeekdays: input.recurrence?.frequency === 'WEEKLY' ? (input.recurrence.byWeekday ?? []) : input.recurrence?.frequency === 'DAILY' ? [1, 2, 3, 4, 5, 6, 7] : [],
      });
      return { backend: 'alarmkit', externalId: result.externalId, notificationId: null, canCancel: true, note: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new DomainError(/authori/i.test(message) ? 'ALARM_PERMISSION_DENIED' : 'ALARM_NOT_SUPPORTED', message, { cause: e });
    }
  }

  async cancelAlarm(record: AlarmRecord): Promise<boolean> {
    if (!BrainVoiceNative || !record.externalId) return false;
    return BrainVoiceNative.cancelAlarm(record.externalId);
  }
}

export class AlarmKitTimerAdapter implements TimerAdapter {
  readonly id = 'ios-alarmkit-timer';

  async capabilities(): Promise<AlarmCapabilities> {
    return { backend: 'alarmkit', supportsExactDate: true, supportsCancel: true, supportsRecurrence: false, limitationNote: null };
  }

  async startTimer(input: TimerInput): Promise<AlarmRecord> {
    if (!BrainVoiceNative) throw new DomainError('ALARM_NOT_SUPPORTED');
    try {
      const result = await BrainVoiceNative.scheduleTimer({ localId: input.localId, seconds: input.seconds, label: input.label ?? 'Timer' });
      return { backend: 'alarmkit', externalId: result.externalId, notificationId: null, canCancel: true, note: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new DomainError(/authori/i.test(message) ? 'ALARM_PERMISSION_DENIED' : 'ALARM_NOT_SUPPORTED', message, { cause: e });
    }
  }

  async cancelTimer(record: AlarmRecord): Promise<boolean> {
    if (!BrainVoiceNative || !record.externalId) return false;
    return BrainVoiceNative.cancelAlarm(record.externalId);
  }
}

export class AndroidClockAlarmAdapter implements AlarmAdapter {
  readonly id = 'android-alarmclock';
  constructor(private readonly language: () => Language) {}

  async capabilities(): Promise<AlarmCapabilities> {
    return { backend: 'android_clock', supportsExactDate: false, supportsCancel: true, supportsRecurrence: true, limitationNote: ANDROID_LIMITATION[this.language()] };
  }

  async getPermission(): Promise<PermissionState> {
    return BrainVoiceNative?.hasClockApp() ? 'granted' : 'unavailable';
  }

  async requestPermission(): Promise<PermissionState> {
    return this.getPermission();
  }

  async setAlarm(input: AlarmInput): Promise<AlarmRecord> {
    if (!BrainVoiceNative || !BrainVoiceNative.hasClockApp()) throw new DomainError('ALARM_NOT_SUPPORTED', 'No clock app handles ACTION_SET_ALARM');
    const days = input.recurrence?.frequency === 'WEEKLY' ? (input.recurrence.byWeekday ?? []).map(toJavaWeekday) : input.recurrence?.frequency === 'DAILY' ? [1, 2, 3, 4, 5, 6, 7] : [];
    const label = input.label ?? 'BrainVoice';
    const ok = await BrainVoiceNative.setClockAlarm({ hour: input.hour, minute: input.minute, label, days, skipUi: true });
    if (!ok) throw new DomainError('ALARM_NOT_SUPPORTED', 'The clock app rejected the alarm intent');
    return { backend: 'android_clock', externalId: label, notificationId: null, canCancel: true, note: ANDROID_LIMITATION[this.language()] };
  }

  async cancelAlarm(record: AlarmRecord): Promise<boolean> {
    if (!BrainVoiceNative || !record.externalId) return false;
    // Best effort: ACTION_DISMISS_ALARM with label search (clock-app dependent).
    return BrainVoiceNative.dismissClockAlarm(record.externalId);
  }
}

export class AndroidClockTimerAdapter implements TimerAdapter {
  readonly id = 'android-alarmclock-timer';

  async capabilities(): Promise<AlarmCapabilities> {
    return { backend: 'android_clock', supportsExactDate: true, supportsCancel: true, supportsRecurrence: false, limitationNote: null };
  }

  async startTimer(input: TimerInput): Promise<AlarmRecord> {
    if (!BrainVoiceNative || !BrainVoiceNative.hasClockApp()) throw new DomainError('ALARM_NOT_SUPPORTED', 'No clock app handles ACTION_SET_TIMER');
    const ok = await BrainVoiceNative.setClockTimer({ seconds: Math.round(input.seconds), label: input.label ?? 'BrainVoice', skipUi: true });
    if (!ok) throw new DomainError('ALARM_NOT_SUPPORTED', 'The clock app rejected the timer intent');
    return { backend: 'android_clock', externalId: input.label ?? 'BrainVoice', notificationId: null, canCancel: true, note: null };
  }

  async cancelTimer(): Promise<boolean> {
    if (!BrainVoiceNative) return false;
    return BrainVoiceNative.dismissClockTimer();
  }
}

/** iOS before 26 (no AlarmKit): the router falls back to a time-sensitive notification. */
export class UnsupportedAlarmAdapter implements AlarmAdapter {
  readonly id = 'alarm-unsupported';
  constructor(private readonly language: () => Language) {}

  async capabilities(): Promise<AlarmCapabilities> {
    const notes: Record<Language, string> = {
      en: 'Real alarms need iOS 26 (AlarmKit). On this device BrainVoice uses a time-sensitive notification.',
      nl: 'Echte wekkers vereisen iOS 26 (AlarmKit). Op dit toestel gebruikt BrainVoice een tijdgevoelige melding.',
      fr: 'Les vraies alarmes nécessitent iOS 26 (AlarmKit). Sur cet appareil BrainVoice utilise une notification prioritaire.',
    };
    return { backend: 'notification', supportsExactDate: true, supportsCancel: true, supportsRecurrence: true, limitationNote: notes[this.language()] };
  }

  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }

  async setAlarm(): Promise<AlarmRecord> {
    throw new DomainError('ALARM_NOT_SUPPORTED');
  }

  async cancelAlarm(): Promise<boolean> {
    return false;
  }
}

/** In-app countdown (plus a notification scheduled by the router) when no system timer exists. */
export class InAppTimerAdapter implements TimerAdapter {
  readonly id = 'timer-in-app';

  async capabilities(): Promise<AlarmCapabilities> {
    return { backend: 'in_app', supportsExactDate: true, supportsCancel: true, supportsRecurrence: false, limitationNote: null };
  }

  async startTimer(input: TimerInput): Promise<AlarmRecord> {
    return { backend: 'in_app', externalId: input.localId, notificationId: null, canCancel: true, note: null };
  }

  async cancelTimer(): Promise<boolean> {
    return true;
  }
}

export function createAlarmAdapters(language: () => Language): { alarms: AlarmAdapter; timers: TimerAdapter } {
  if (Platform.OS === 'ios') {
    const alarmKit = Boolean(BrainVoiceNative?.isAlarmKitAvailable());
    return alarmKit ? { alarms: new AlarmKitAlarmAdapter(), timers: new AlarmKitTimerAdapter() } : { alarms: new UnsupportedAlarmAdapter(language), timers: new InAppTimerAdapter() };
  }
  if (Platform.OS === 'android') {
    const clock = Boolean(BrainVoiceNative?.hasClockApp());
    return clock ? { alarms: new AndroidClockAlarmAdapter(language), timers: new AndroidClockTimerAdapter() } : { alarms: new UnsupportedAlarmAdapter(language), timers: new InAppTimerAdapter() };
  }
  return { alarms: new UnsupportedAlarmAdapter(language), timers: new InAppTimerAdapter() };
}
