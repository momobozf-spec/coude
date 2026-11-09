export const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const int = (n: number) => new Intl.NumberFormat("nl-BE").format(n);
export const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("nl-BE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Brussels" }) : "—";
export const d = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" }) : "—";
export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
