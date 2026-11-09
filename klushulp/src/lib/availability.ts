import type { TimePreference } from "@/db/schema";

export type Slot = { weekday: number; startMin: number; endMin: number };
export type TimeOff = { dateFrom: string; dateTo: string };

export const TIME_PREF_RANGE: Record<TimePreference, [number, number]> = {
  any: [0, 24 * 60],
  morning: [7 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 22 * 60],
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function offOn(date: string, timeOff: TimeOff[]): boolean {
  return timeOff.some((t) => t.dateFrom <= date && date <= t.dateTo);
}

/**
 * Eerste dag binnen [dateFrom, dateTo] waarop de dienstverlener een slot heeft dat overlapt met de tijdvoorkeur.
 * Geen datum opgegeven = de komende 14 dagen vanaf morgen. Geeft null als er niets past (geen verzonnen beschikbaarheid).
 */
export function firstAvailableDay(
  slots: Slot[],
  timeOff: TimeOff[],
  opts: { dateFrom?: string | null; dateTo?: string | null; timePreference: TimePreference; today?: Date; horizonDays?: number },
): { date: string; startMin: number; endMin: number } | null {
  const today = opts.today ?? new Date();
  const start = opts.dateFrom ? new Date(`${opts.dateFrom}T00:00:00Z`) : addDays(new Date(`${isoDate(today)}T00:00:00Z`), 1);
  const end = opts.dateTo ? new Date(`${opts.dateTo}T00:00:00Z`) : addDays(start, (opts.horizonDays ?? 14) - 1);
  if (end < start) return null;
  const [prefStart, prefEnd] = TIME_PREF_RANGE[opts.timePreference];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = isoDate(d);
    if (offOn(date, timeOff)) continue;
    const weekday = d.getUTCDay();
    const match = slots
      .filter((s) => s.weekday === weekday && s.startMin < prefEnd && s.endMin > prefStart)
      .sort((a, b) => a.startMin - b.startMin)[0];
    if (match) return { date, startMin: Math.max(match.startMin, prefStart), endMin: Math.min(match.endMin, prefEnd) };
  }
  return null;
}

export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
