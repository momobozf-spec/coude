/**
 * Field-level normalizers for Belgian real-estate data.
 * Each normalizer is pure and defensive: bad input yields null, never throws.
 */

import { isValidBelgianPostalCode, normalizeMunicipality, provinceForPostalCode } from "./belgium";

export function normalizePostalCode(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!isValidBelgianPostalCode(digits)) return null;
  return digits;
}

/** "B-9000 Gent" → { postalCode: "9000", city: "gent" } */
export function normalizeCity(raw: string | null | undefined): string | null {
  return normalizeMunicipality(raw);
}

export function normalizeProvince(postalCode: string | null): string | null {
  if (!postalCode) return null;
  return provinceForPostalCode(postalCode);
}

/**
 * Belgian phone → E.164 (+32...). Accepts "09 223 45 67", "0472/12.34.56",
 * "+32 472 123 456", "0032472123456". Returns null when not plausibly Belgian.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+32")) return null;
    digits = "0" + digits.slice(3);
  }
  if (!digits.startsWith("0")) return null;
  const national = digits.slice(1);
  // Mobile: 4xx xxx xxx (9 digits). Landline: 8 digits (area 1-2 digits).
  if (!/^\d{8,9}$/.test(national)) return null;
  if (national.length === 9 && !national.startsWith("4")) return null;
  return "+32" + national;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Person-name normalization for matching: lowercase, strip diacritics,
 * collapse whitespace, sort tokens so "Janssens Pieter" == "Pieter Janssens".
 */
export function normalizePersonName(
  firstName: string | null | undefined,
  lastName?: string | null,
): string | null {
  const joined = [firstName ?? "", lastName ?? ""].join(" ");
  const tokens = joined
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 0)
    .sort();
  if (tokens.length === 0) return null;
  return tokens.join(" ");
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  str: "straat",
  "str.": "straat",
  stwg: "steenweg",
  "stwg.": "steenweg",
  stw: "steenweg",
  ln: "laan",
  "ln.": "laan",
  av: "avenue",
  "av.": "avenue",
  bd: "boulevard",
  "bd.": "boulevard",
  chee: "chaussee",
  "chée": "chaussee",
};

/** Normalize street names: lowercase, strip diacritics, expand abbreviations. */
export function normalizeStreet(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
  if (s === "") return null;
  for (const [abbr, full] of Object.entries(STREET_ABBREVIATIONS)) {
    const escaped = abbr.replace(/\./g, "\\.");
    s = s.replace(new RegExp(`\\b${escaped}(?=\\s|$)`, "g"), full);
  }
  // "kerk straat" → "kerkstraat" (suffix glued in canonical Flemish style).
  // Only glue after a consonant: adjectives end in -e ("Brusselse Steenweg")
  // and must remain separate words.
  s = s.replace(/([b-df-hj-np-tv-z]) (straat|steenweg|laan|weg|dreef|plein|lei|kaai)\b/g, "$1$2");
  return s;
}

export function normalizeHouseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (cleaned === "") return null;
  // "12busA" → keep number + box; primary comparison uses the numeric part
  return cleaned;
}

/** Extract "Veldstraat 12, 9000 Gent"-style addresses into parts. */
export function parseAddress(raw: string | null | undefined): {
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
} {
  const empty = { street: null, houseNumber: null, postalCode: null, city: null };
  if (!raw) return empty;
  const text = raw.trim();
  if (text === "") return empty;

  let street: string | null = null;
  let houseNumber: string | null = null;
  let postalCode: string | null = null;
  let city: string | null = null;

  const pcMatch = text.match(/\b([1-9]\d{3})\b\s*([\p{L}\s-]+)?/u);
  if (pcMatch) {
    postalCode = pcMatch[1] ?? null;
    city = normalizeMunicipality(pcMatch[2] ?? null);
  }

  const streetPart = text.split(",")[0] ?? text;
  const streetMatch = streetPart.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\s*(?:bus|bte|box)\s*\w+)?)$/u);
  if (streetMatch) {
    street = normalizeStreet(streetMatch[1]);
    houseNumber = normalizeHouseNumber(streetMatch[2]);
  } else if (!/\d{4}/.test(streetPart)) {
    street = normalizeStreet(streetPart);
  }

  return { street, houseNumber, postalCode, city };
}

/** "€ 495.000", "495000", "495.000,50", 495000 → integer euros. */
export function normalizePrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw);
  }
  let s = raw.replace(/[€\s]/g, "").replace(/eur(os?)?$/i, "");
  if (s === "") return null;
  // European format: dots as thousands separators, comma as decimal
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+(,\d+)?$/.test(s)) {
    s = s.replace(",", ".");
  } else if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const value = parseFloat(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function normalizeCurrency(raw: string | null | undefined): string {
  if (!raw) return "EUR";
  const c = raw.trim().toUpperCase();
  if (c === "€" || c === "EURO" || c === "EUR") return "EUR";
  return c;
}

/** "150 m²", "150m2", 150 → integer m². */
export function normalizeSurface(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw);
  }
  const match = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]!);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function normalizeBedrooms(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0 || raw > 30) return null;
    return raw;
  }
  const match = raw.match(/\d+/);
  if (!match) return null;
  const value = parseInt(match[0], 10);
  if (value < 0 || value > 30) return null;
  return value;
}

const PROPERTY_TYPE_MAP: Record<string, "HOUSE" | "APARTMENT" | "LAND" | "COMMERCIAL" | "OTHER"> = {
  huis: "HOUSE",
  woning: "HOUSE",
  house: "HOUSE",
  maison: "HOUSE",
  villa: "HOUSE",
  rijwoning: "HOUSE",
  eengezinswoning: "HOUSE",
  appartement: "APARTMENT",
  apartment: "APARTMENT",
  flat: "APARTMENT",
  studio: "APARTMENT",
  penthouse: "APARTMENT",
  duplex: "APARTMENT",
  grond: "LAND",
  bouwgrond: "LAND",
  land: "LAND",
  terrain: "LAND",
  handelspand: "COMMERCIAL",
  kantoor: "COMMERCIAL",
  commercial: "COMMERCIAL",
  winkel: "COMMERCIAL",
  horeca: "COMMERCIAL",
  garage: "OTHER",
  parking: "OTHER",
};

export function normalizePropertyType(
  raw: string | null | undefined,
): "HOUSE" | "APARTMENT" | "LAND" | "COMMERCIAL" | "OTHER" | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  const key = raw.trim().toLowerCase();
  return PROPERTY_TYPE_MAP[key] ?? "UNKNOWN";
}

export function normalizeListingType(raw: string | null | undefined): "SALE" | "RENT" {
  if (!raw) return "SALE";
  const s = raw.trim().toLowerCase();
  if (["rent", "huur", "te huur", "location", "louer", "a louer", "à louer"].includes(s)) {
    return "RENT";
  }
  return "SALE";
}

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeTimestamp(raw: string | Date | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const trimmed = raw.trim();
  // dd/mm/yyyy or dd-mm-yyyy (Belgian convention)
  const beMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (beMatch) {
    const [, d, m, y] = beMatch;
    const date = new Date(Date.UTC(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}
