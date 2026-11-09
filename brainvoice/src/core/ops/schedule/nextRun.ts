import { DateTime } from 'luxon';

import type { ScheduleSpec } from '../../domain/ops';
import type { Language } from '../../types/common';

/**
 * Timezone-aware next-run computation (§164). Everything is evaluated in the schedule's
 * IANA zone with Luxon, so "08:00" stays 08:00 across DST changes.
 */

export interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number> | null;
  months: Set<number> | null;
  daysOfWeek: Set<number> | null;
}

function parseField(field: string, min: number, max: number): Set<number> | null {
  if (field === '*') return null;
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part);
    const base = stepMatch ? stepMatch[1]! : part;
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    if (!Number.isFinite(step) || step <= 0) return undefined as unknown as null;
    let lo: number;
    let hi: number;
    if (base === '*') {
      lo = min;
      hi = max;
    } else if (/^\d+-\d+$/.test(base)) {
      const [a, b] = base.split('-').map(Number);
      lo = a!;
      hi = b!;
    } else if (/^\d+$/.test(base)) {
      lo = Number(base);
      hi = stepMatch ? max : lo;
    } else {
      return undefined as unknown as null;
    }
    if (lo < min || hi > max || lo > hi) return undefined as unknown as null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/** 5-field cron: minute hour day-of-month month day-of-week (0 or 7 = Sunday). Returns null when invalid. */
export function parseCron(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const minutes = parseField(parts[0]!, 0, 59);
  const hours = parseField(parts[1]!, 0, 23);
  const dom = parseField(parts[2]!, 1, 31);
  const months = parseField(parts[3]!, 1, 12);
  const dow = parseField(parts[4]!, 0, 7);
  if (minutes === undefined || hours === undefined || dom === undefined || months === undefined || dow === undefined) return null;
  const daysOfWeek = dow ? new Set([...dow].map((d) => (d === 7 ? 0 : d))) : null;
  return { minutes: minutes ?? new Set(range(0, 59)), hours: hours ?? new Set(range(0, 23)), daysOfMonth: dom, months, daysOfWeek };
}

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

function parseAt(at: string | undefined): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(at ?? '');
  if (!m) return { hour: 8, minute: 0 };
  return { hour: Math.min(23, Number(m[1])), minute: Math.min(59, Number(m[2])) };
}

export function computeNextRun(spec: ScheduleSpec, after: DateTime, zone: string): DateTime | null {
  const base = after.setZone(zone);
  switch (spec.kind) {
    case 'once': {
      if (!spec.runAt) return null;
      const at = DateTime.fromISO(spec.runAt, { zone });
      return at.isValid && at > base ? at : null;
    }
    case 'interval': {
      const minutes = Math.max(1, Math.round(spec.everyMinutes ?? 60));
      return base.plus({ minutes }).set({ second: 0, millisecond: 0 });
    }
    case 'daily': {
      const { hour, minute } = parseAt(spec.at);
      let candidate = base.set({ hour, minute, second: 0, millisecond: 0 });
      if (candidate <= base) candidate = candidate.plus({ days: 1 }).set({ hour, minute, second: 0, millisecond: 0 });
      return candidate;
    }
    case 'weekly': {
      const { hour, minute } = parseAt(spec.at);
      const weekdays = (spec.weekdays?.length ? spec.weekdays : [1]).map((d) => ((d - 1) % 7) + 1);
      for (let offset = 0; offset < 8; offset++) {
        const day = base.plus({ days: offset });
        if (!weekdays.includes(day.weekday)) continue;
        const candidate = day.set({ hour, minute, second: 0, millisecond: 0 });
        if (candidate > base) return candidate;
      }
      return null;
    }
    case 'cron': {
      const fields = spec.cron ? parseCron(spec.cron) : null;
      if (!fields) return null;
      return nextCron(fields, base);
    }
    default:
      return null;
  }
}

function nextCron(fields: CronFields, after: DateTime): DateTime | null {
  const start = after.plus({ minutes: 1 }).set({ second: 0, millisecond: 0 });
  const hours = [...fields.hours].sort((a, b) => a - b);
  const minutes = [...fields.minutes].sort((a, b) => a - b);
  for (let dayOffset = 0; dayOffset < 400; dayOffset++) {
    const day = start.plus({ days: dayOffset }).startOf('day');
    if (fields.months && !fields.months.has(day.month)) continue;
    const dowMatch = fields.daysOfWeek ? fields.daysOfWeek.has(day.weekday % 7) : true;
    const domMatch = fields.daysOfMonth ? fields.daysOfMonth.has(day.day) : true;
    // Standard cron semantics: when both day fields are restricted, either may match.
    const dayOk = fields.daysOfWeek && fields.daysOfMonth ? dowMatch || domMatch : dowMatch && domMatch;
    if (!dayOk) continue;
    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = day.set({ hour, minute });
        if (candidate >= start) return candidate;
      }
    }
  }
  return null;
}

const DAY_NAMES: Record<Language, string[]> = {
  nl: ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
};

export function describeSpec(spec: ScheduleSpec, language: Language): string {
  switch (spec.kind) {
    case 'once':
      return `${{ nl: 'eenmalig op', en: 'once on', fr: 'une fois le' }[language]} ${spec.runAt ?? '?'}`;
    case 'interval': {
      const n = spec.everyMinutes ?? 60;
      if (n % 60 === 0) return `${{ nl: 'elke', en: 'every', fr: 'toutes les' }[language]} ${n / 60} ${{ nl: n === 60 ? 'uur' : 'uur', en: n === 60 ? 'hour' : 'hours', fr: n === 60 ? 'heure' : 'heures' }[language]}`;
      return `${{ nl: 'elke', en: 'every', fr: 'toutes les' }[language]} ${n} ${{ nl: 'minuten', en: 'minutes', fr: 'minutes' }[language]}`;
    }
    case 'daily':
      return `${{ nl: 'dagelijks om', en: 'daily at', fr: 'chaque jour à' }[language]} ${spec.at ?? '08:00'}`;
    case 'weekly': {
      const names = (spec.weekdays?.length ? spec.weekdays : [1]).map((d) => DAY_NAMES[language][((d - 1) % 7 + 7) % 7]);
      return `${{ nl: 'elke', en: 'every', fr: 'chaque' }[language]} ${names.join(', ')} ${{ nl: 'om', en: 'at', fr: 'à' }[language]} ${spec.at ?? '08:00'}`;
    }
    case 'cron':
      return `cron ${spec.cron ?? ''}`;
    default:
      return '';
  }
}
