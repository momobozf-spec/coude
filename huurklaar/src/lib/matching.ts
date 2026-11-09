// Matchscore van één pand tegen het zoekprofiel. Puur en getest.

export interface SearchProfile {
  maxMonthly: number | null;
  municipalities: string[];
  minBedrooms: number;
  pets: boolean;
}

export interface Listing {
  title: string;
  url: string;
  municipality: string | null;
  postcode: string | null;
  rent_eur: number | null;
  charges_eur: number | null;
  bedrooms: number | null;
  pets_allowed: boolean | null;
}

export type Reason =
  | "budget_ok" | "budget_tight" | "budget_over" | "budget_unknown"
  | "area_ok" | "area_other" | "area_unknown"
  | "bedrooms_ok" | "bedrooms_low" | "bedrooms_unknown"
  | "pets_no" | "pets_unknown";

/** Huidige bronnen waarvan we links aanvaarden. */
const SOURCES: Record<string, string> = {
  "immoweb.be": "immoweb",
  "zimmo.be": "zimmo",
  "immovlan.be": "immovlan",
  "realo.be": "realo",
};

export function sourceOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    for (const [domain, name] of Object.entries(SOURCES)) {
      if (host === domain || host.endsWith(`.${domain}`)) return name;
    }
    return null;
  } catch {
    return null;
  }
}

/** Gemeentenamen vergelijken zonder accenten, hoofdletters en koppeltekens. */
export function normalizePlace(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function parsePlaces(input: string): string[] {
  return Array.from(new Set(input.split(/[,;\n]/).map(normalizePlace).filter(Boolean))).slice(0, 30);
}

/**
 * Score 0–100. Budget 50 · ligging 25 · slaapkamers 15 · huisdieren 10.
 * Onbekende info telt half, zodat een onvolledige advertentie niet wegvalt maar ook niet bovenaan komt.
 */
export function scoreListing(l: Listing, p: SearchProfile): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = 0;

  // Budget
  const total = l.rent_eur != null ? l.rent_eur + (l.charges_eur ?? 0) : null;
  if (!p.maxMonthly || total == null) {
    score += 25;
    reasons.push("budget_unknown");
  } else if (total <= p.maxMonthly * 0.95) {
    score += 50;
    reasons.push("budget_ok");
  } else if (total <= p.maxMonthly) {
    score += 38;
    reasons.push("budget_tight");
  } else {
    reasons.push("budget_over");
  }

  // Ligging
  if (!p.municipalities.length) {
    score += 25;
  } else {
    const cands = [l.municipality, l.postcode].filter((x): x is string => !!x).map(normalizePlace);
    if (!cands.length) {
      score += 12;
      reasons.push("area_unknown");
    } else if (cands.some((c) => p.municipalities.some((m) => c === m || c.includes(m) || m.includes(c)))) {
      score += 25;
      reasons.push("area_ok");
    } else {
      reasons.push("area_other");
    }
  }

  // Slaapkamers
  if (p.minBedrooms <= 0) score += 15;
  else if (l.bedrooms == null) { score += 7; reasons.push("bedrooms_unknown"); }
  else if (l.bedrooms >= p.minBedrooms) { score += 15; reasons.push("bedrooms_ok"); }
  else reasons.push("bedrooms_low");

  // Huisdieren
  if (!p.pets) score += 10;
  else if (l.pets_allowed === false) reasons.push("pets_no");
  else if (l.pets_allowed == null) { score += 5; reasons.push("pets_unknown"); }
  else score += 10;

  // Harde uitsluitingen drukken de score onder de drempel.
  if (reasons.includes("budget_over") || reasons.includes("area_other")) score = Math.min(score, 45);
  return { score, reasons };
}

export const MATCH_THRESHOLD = 60;
