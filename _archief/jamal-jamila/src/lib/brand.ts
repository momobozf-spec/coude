/**
 * Central brand configuration for Layali — Oriental Lifestyle.
 *
 * Everything brand-related (name, taglines, contact, order-number prefix,
 * social analytics ids) lives here so a future rebrand is a single-file change.
 * Values that are environment-specific (domain, support email) fall back to
 * sensible defaults but can be overridden via env vars for production.
 */

export const brand = {
  name: "Layali",
  legalName: "Layali BV",
  /** Arabic for "nights" — evokes the 1001-nights atmosphere. */
  arabic: "ليالي",
  tagline: "Breng de warmte van de Oriënt in huis.",
  taglineFr: "Apportez la chaleur de l'Orient chez vous.",
  description:
    "Oriental lifestyle voor thuis — theeglazen, lantaarns, geurkaarsen, home fragrance, decoratie en sfeervolle cadeaus. Warm, elegant en betaalbaar.",
  descriptionFr:
    "Lifestyle oriental pour la maison — verres à thé, lanternes, bougies parfumées, décoration et cadeaux chaleureux.",
  /** Order number prefix → LAYALI-2026-000001 */
  orderPrefix: "LAYALI",
  email: {
    from: process.env.RESEND_FROM || "Layali <noreply@layali.shop>",
    admin: process.env.ADMIN_EMAIL || "orders@layali.shop",
    support: process.env.SUPPORT_EMAIL || "hello@layali.shop",
  },
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  social: {
    instagram: "https://instagram.com/layali.shop",
    tiktok: "https://tiktok.com/@layali.shop",
    pinterest: "https://pinterest.com/layalishop",
  },
} as const;

/**
 * Build a human-friendly, sequential order number.
 * `seq` is a 1-based counter (e.g. total orders + 1).
 * Format: LAYALI-2026-000042
 */
export function formatOrderNumber(seq: number, year = 2026): string {
  return `${brand.orderPrefix}-${year}-${String(seq).padStart(6, "0")}`;
}
