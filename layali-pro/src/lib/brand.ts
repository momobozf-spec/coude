/**
 * Merkconfiguratie van Layali.
 *
 * Wat omgevingsafhankelijk is (domein, e-mailadressen) wordt bij elke aanroep
 * uit de omgeving gelezen, niet bij de build: de Docker-image wordt zonder
 * die waarden gebouwd. Daarom APP_URL en niet NEXT_PUBLIC_APP_URL, want
 * NEXT_PUBLIC_-variabelen worden tijdens de build in de code geplakt.
 *
 * De juridische gegevens (onderneming, btw, adres) staan in legal.ts en zijn
 * alleen aan serverkant beschikbaar.
 */

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const brand = {
  name: "Layali",
  /** Arabisch voor "nachten" — de sfeer van duizend-en-één-nacht. */
  arabic: "ليالي",
  tagline: "Breng de warmte van de Oriënt in huis.",
  taglineFr: "Apportez la chaleur de l'Orient chez vous.",
  description:
    "Oriental lifestyle voor thuis — theeglazen, lantaarns, geurkaarsen, home fragrance, decoratie en sfeervolle cadeaus. Warm, elegant en betaalbaar.",
  descriptionFr:
    "Lifestyle oriental pour la maison — verres à thé, lanternes, bougies parfumées, décoration et cadeaux chaleureux.",
  /** Prefix van het ordernummer → LAYALI-2026-000001 */
  orderPrefix: "LAYALI",
  email: {
    get from() {
      return env("RESEND_FROM") ?? "Layali <noreply@layali.shop>";
    },
    get admin() {
      return env("ADMIN_EMAIL") ?? "orders@layali.shop";
    },
    get support() {
      return env("SUPPORT_EMAIL") ?? "hello@layali.shop";
    },
  },
  /** Publieke basis-URL zonder slash op het einde. */
  get url(): string {
    return (env("APP_URL") ?? env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  social: {
    instagram: "https://instagram.com/layali.shop",
    tiktok: "https://tiktok.com/@layali.shop",
    pinterest: "https://pinterest.com/layalishop",
  },
};

/**
 * Leesbaar, oplopend ordernummer. `seq` komt uit de Postgres-sequence.
 * Formaat: LAYALI-2026-000042
 */
export function formatOrderNumber(seq: number, year: number): string {
  return `${brand.orderPrefix}-${year}-${String(seq).padStart(6, "0")}`;
}
