import { DateTime } from 'luxon';

/** Injectable time source so services and tests agree on "now" and the zone. */
export interface Clock {
  now(): DateTime;
  timezone(): string;
  nowISO(): string;
  today(): string;
}

export function createClock(timezone: () => string): Clock {
  return {
    now: () => DateTime.now().setZone(timezone()),
    timezone,
    nowISO: () => DateTime.now().setZone(timezone()).toISO({ suppressMilliseconds: true }) ?? new Date().toISOString(),
    today: () => DateTime.now().setZone(timezone()).toISODate() ?? new Date().toISOString().slice(0, 10),
  };
}

export function createFixedClock(iso: string, timezone: string): Clock & { set(iso: string): void } {
  let current = DateTime.fromISO(iso, { zone: timezone });
  return {
    now: () => current,
    timezone: () => timezone,
    nowISO: () => current.toISO({ suppressMilliseconds: true }) ?? iso,
    today: () => current.toISODate() ?? iso.slice(0, 10),
    set: (next: string) => {
      current = DateTime.fromISO(next, { zone: timezone });
    },
  };
}
