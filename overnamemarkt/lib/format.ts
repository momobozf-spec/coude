export const LISTING_TYPES = ["SaaS", "Website", "App", "E-commerce", "Online dienst"] as const;
export const COUNTRIES = ["BE", "NL"] as const;
export const BUDGETS = ["Tot €50.000", "€50.000 – €150.000", "€150.000 – €500.000", "Meer dan €500.000"] as const;

export type ListingStatus = "pending" | "published" | "rejected" | "under_offer" | "sold" | "withdrawn";
export const PUBLIC_STATUSES: ListingStatus[] = ["published", "under_offer"];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  pending: "Ter controle",
  published: "Actief",
  rejected: "Afgewezen",
  under_offer: "Onder bod",
  sold: "Verkocht",
  withdrawn: "Ingetrokken",
};

export const INTEREST_STATUS_LABEL: Record<string, string> = {
  new: "Nieuw",
  forwarded: "Doorgestuurd naar verkoper",
  closed: "Afgesloten",
};

export function countryName(code: string | null | undefined): string {
  if (code === "BE") return "België";
  if (code === "NL") return "Nederland";
  return "—";
}

export function eur(value: number | string | null | undefined): string {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "—";
  return "€" + Math.round(n).toLocaleString("nl-BE");
}

export function multiple(price: number | string, profit: number | string): number | null {
  const p = Number(price);
  const w = Number(profit);
  if (!(p > 0) || !(w > 0)) return null;
  return p / w;
}

export function formatMultiple(price: number | string, profit: number | string): string {
  const m = multiple(price, profit);
  return m === null ? "—" : m.toLocaleString("nl-BE", { maximumFractionDigits: 1 }) + "× winst";
}

export function dateNl(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Brussels" });
}

/** Alleen interne paden toelaten als redirect-doel (geen open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
