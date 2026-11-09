/** Bedragen in centen; weergave als euro met Belgische notatie. */
export function formatCents(cents: number, locale: "nl" | "fr" = "nl"): string {
  const euros = cents / 100;
  return new Intl.NumberFormat(locale === "fr" ? "fr-BE" : "nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(euros);
}

export function parseEuroToCents(input: string): number | null {
  const cleaned = input.replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

/** Platformkosten: percentage in basispunten van het referentiebedrag, met minimum. */
export function platformFee(referenceCents: number, feeBps: number, minCents: number): number {
  const pct = Math.round((referenceCents * feeBps) / 10_000);
  return Math.max(pct, minCents);
}

/**
 * Referentiebedrag voor platformkosten per prijssoort.
 * fixed → bedrag; estimate → ondergrens (nooit meer aanrekenen dan zeker is); hourly → uurtarief × minimum uren; inspection → diagnosekost.
 */
export function feeReference(p: {
  priceType: "fixed" | "hourly" | "estimate" | "inspection";
  amountCents?: number | null;
  amountMinCents?: number | null;
  hourlyRateCents?: number | null;
  estimatedHoursMin?: number | null;
}): number {
  switch (p.priceType) {
    case "fixed":
    case "inspection":
      return p.amountCents ?? 0;
    case "estimate":
      return p.amountMinCents ?? 0;
    case "hourly":
      return (p.hourlyRateCents ?? 0) * (p.estimatedHoursMin ?? 1);
  }
}
