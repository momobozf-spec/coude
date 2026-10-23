/**
 * Datumrekenkunde in UTC.
 *
 * Alle juridische termijnen in deze applicatie rekenen in hele dagen en hele
 * maanden. Twee valkuilen worden hier één keer opgelost in plaats van op elke
 * roepplaats:
 *
 *  1. **Maandoverloop.** `setMonth` laat 31 december plus twee maanden op
 *     3 maart uitkomen. Voor een wettelijke termijn is dat fout: die eindigt op
 *     28 (of 29) februari. Wij klemmen naar de laatste dag van de doelmaand.
 *  2. **Tijdzone en uur.** Een termijn die om 12:00 begint mag niet anders
 *     uitvallen dan een die om 00:00 begint. Alles wordt op middernacht UTC
 *     genormaliseerd.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Telt maanden op bij een datum, met klemming op de laatste dag van de
 * doelmaand. Negatieve waarden trekken maanden af.
 *
 *   31/12/2025 + 2 maanden -> 28/02/2026 (niet 03/03/2026)
 *   29/08/2026 - 6 maanden -> 28/02/2026 (niet 01/03/2026)
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthStart = new Date(Date.UTC(year, month + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(day, daysInTargetMonth),
    ),
  );
}

/** Verschil in hele dagen tussen twee data, ongeacht het tijdstip. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY,
  );
}

/**
 * Aantal *begonnen* maanden tussen twee data. Eén dag te laat telt als één
 * maand vertraging.
 */
export function commencedMonthsBetween(from: Date, to: Date): number {
  const start = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  if (end <= start) return 0;

  const fullMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) -
    (end.getUTCDate() < start.getUTCDate() ? 1 : 0);

  return Math.max(0, fullMonths) + 1;
}

/** Parseert een ISO-datum (`YYYY-MM-DD`) naar middernacht UTC, of null. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfUtcDay(parsed);
}

/** `YYYY-MM-DD` van een datum, in UTC. */
export function toIsoDate(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}
