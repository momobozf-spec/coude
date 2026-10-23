/**
 * Alle bedragen zijn gehele eurocenten (integer). Nooit floats voor geld.
 * Percentages worden opgeslagen in basispunten (bps): 1200 bps = 12,00%.
 */

export type Cents = number;
export type Bps = number;

export function assertCents(value: number, label = 'bedrag'): asserts value is Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} moet een geheel aantal centen zijn, kreeg ${value}`);
  }
}

/** Percentage van een bedrag, afgerond op de cent (half-up). */
export function applyBps(amount: Cents, bps: Bps): Cents {
  assertCents(amount);
  if (!Number.isInteger(bps) || bps < 0) throw new Error(`ongeldige bps: ${bps}`);
  return Math.round((amount * bps) / 10_000);
}

/** BTW-deel uit een bedrag inclusief BTW. */
export function vatFromGross(gross: Cents, vatBps: Bps): Cents {
  assertCents(gross);
  return gross - Math.round((gross * 10_000) / (10_000 + vatBps));
}

export function formatEur(amount: Cents): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const euros = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}€${euros},${cents}`;
}
