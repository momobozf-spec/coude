export const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO calendar date (YYYY-MM-DD) in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whether `at` falls within [from, until] where either bound may be open. */
export function isWithin(at: Date, from: Date | null | undefined, until: Date | null | undefined): boolean {
  if (from && at.getTime() < from.getTime()) return false;
  if (until && at.getTime() > until.getTime()) return false;
  return true;
}
