// Kosten- en omzetberekeningen. Puur en getest. Geen schattingen: ontbrekende tarieven blijven onbekend.

export interface ModelPrice {
  inputPerMTok: number;  // USD per miljoen input-tokens
  outputPerMTok: number; // USD per miljoen output-tokens
}

/**
 * Leest tarieven uit een env-string zoals:
 *   "claude-sonnet-5-5=3:15,claude-haiku-5-5=1:5"
 * Vul de echte prijzen in van anthropic.com/pricing. Ongeldige stukken worden genegeerd.
 */
export function parsePrices(raw: string | undefined): Record<string, ModelPrice> {
  const out: Record<string, ModelPrice> = {};
  for (const part of (raw ?? "").split(",")) {
    const m = /^\s*([\w.-]+)\s*=\s*([\d.]+)\s*:\s*([\d.]+)\s*$/.exec(part);
    if (!m) continue;
    const i = Number(m[2]), o = Number(m[3]);
    if (Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o >= 0) out[m[1]] = { inputPerMTok: i, outputPerMTok: o };
  }
  return out;
}

/** Kost in euro, of null als het tarief van dit model niet ingesteld is. */
export function tokenCostEur(
  model: string, input: number, output: number, prices: Record<string, ModelPrice>, usdToEur: number,
): number | null {
  const p = prices[model];
  if (!p || !(usdToEur > 0)) return null;
  return ((input / 1e6) * p.inputPerMTok + (output / 1e6) * p.outputPerMTok) * usdToEur;
}

/** Bedrag zonder btw uit een bedrag met btw. */
export function exVat(grossCents: number, vatRatePct: number): number {
  return grossCents / (1 + vatRatePct / 100);
}

export interface FixedCost {
  monthly_eur: number;
  starts_on: string; // YYYY-MM-DD
  ends_on: string | null;
}

/**
 * Vaste kosten toegerekend aan een periode [from, to), dag per dag pro rata
 * volgens het aantal dagen van elke kalendermaand.
 */
export function fixedCostsInPeriod(costs: FixedCost[], from: Date, to: Date): number {
  let total = 0;
  for (const c of costs) {
    const start = new Date(`${c.starts_on}T00:00:00Z`);
    const end = c.ends_on ? new Date(`${c.ends_on}T00:00:00Z`) : null;
    for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d < to; d = new Date(d.getTime() + 86_400_000)) {
      if (d < start) continue;
      if (end && d > end) break;
      const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      total += Number(c.monthly_eur) / daysInMonth;
    }
  }
  return total;
}

export interface PaymentRow {
  amount_cents: number;
  refunded_cents: number;
  fee_cents: number | null;
}

export function sumPayments(rows: PaymentRow[], vatRatePct: number) {
  let gross = 0, refunded = 0, fees = 0, feesUnknown = 0;
  for (const r of rows) {
    gross += r.amount_cents;
    refunded += r.refunded_cents;
    if (r.fee_cents == null) feesUnknown++;
    else fees += r.fee_cents;
  }
  const netGross = gross - refunded;
  return {
    grossEur: gross / 100,
    refundedEur: refunded / 100,
    revenueExVatEur: exVat(netGross, vatRatePct) / 100,
    vatEur: (netGross - exVat(netGross, vatRatePct)) / 100,
    stripeFeesEur: fees / 100,
    feesUnknown,
  };
}
