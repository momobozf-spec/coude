// Display prices for the Pro and School plans.
//
// The amount actually charged ALWAYS comes from the Stripe Price objects
// (STRIPE_*_PRICE_ID). These values are only what the site SHOWS, so keep them equal to
// the Stripe prices (incl. VAT for consumers). Configure via NEXT_PUBLIC_* env vars
// (inlined at build time).
//
// TODO(Mohamed): amounts are still to be confirmed. While NEXT_PUBLIC_PRICES_CONFIRMED
// is not "true", every price on the site carries a "prices to be confirmed" label.

function num(value: string | undefined, fallback: number): number {
  const n = value ? Number.parseFloat(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const PRICE_CURRENCY = (process.env.NEXT_PUBLIC_PRICE_CURRENCY || "EUR").toUpperCase();
export const PRICES_CONFIRMED = process.env.NEXT_PUBLIC_PRICES_CONFIRMED === "true";

export const PRICES = {
  pro: {
    monthly: num(process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY, 12),
    yearly: num(process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY, 97),
  },
  school: {
    monthly: num(process.env.NEXT_PUBLIC_PRICE_SCHOOL_MONTHLY, 49),
    yearly: num(process.env.NEXT_PUBLIC_PRICE_SCHOOL_YEARLY, 397),
  },
} as const;

const LOCALE_TAGS: Record<string, string> = { nl: "nl-BE", fr: "fr-BE", de: "de-DE", en: "en-IE" };

export function formatPrice(amount: number, locale = "nl"): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] || "nl-BE", {
    style: "currency",
    currency: PRICE_CURRENCY,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Monthly equivalent of a yearly price, rounded down to whole units. */
export function monthlyEquivalent(yearly: number): number {
  return Math.floor(yearly / 12);
}

const TBC_LABEL: Record<string, string> = {
  nl: "te bevestigen",
  en: "to be confirmed",
  fr: "à confirmer",
  de: "noch zu bestätigen",
};

/** Suffix such as " (te bevestigen)" while prices are not confirmed, otherwise "". */
export function tbcSuffix(locale = "nl"): string {
  return PRICES_CONFIRMED ? "" : ` (${TBC_LABEL[locale] || TBC_LABEL.nl})`;
}
