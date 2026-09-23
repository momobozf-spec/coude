import type { ListingType, PropertyType, SellerType } from "@/generated/prisma/enums";
import { canonicalCityName, canonicalProvince, municipalityForPostalCode, provinceForPostalCode } from "./belgium";

/** Strip accents, lowercase, collapse whitespace. */
export function foldText(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length ? s : null;
}

export function normalizePostalCode(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const digits = String(input).replace(/\D/g, "");
  // Accept "B-9000", "9000", " 9000 ", 9000
  if (digits.length !== 4) return null;
  const n = Number(digits);
  if (n < 1000 || n > 9999) return null;
  return digits;
}

export function normalizePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? Math.round(input) : null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (/op aanvraag|on request|sur demande|prijs op aanvraag/.test(s)) return null;
  // Remove currency tokens and words
  s = s.replace(/€|eur|euro|euros|\bk\b/g, (m) => (m === "k" ? "k" : "")).replace(/[^\d.,k]/g, "");
  const hasK = s.endsWith("k");
  if (hasK) s = s.slice(0, -1);
  // "495.000,00" (nl-BE) or "495,000.00" (en) or "495000"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(hasK ? n * 1000 : n);
}

export function normalizeCurrency(input: string | null | undefined): string {
  if (!input) return "EUR";
  const s = input.trim().toUpperCase();
  if (s === "€" || s === "EURO" || s === "EUROS" || s === "EUR") return "EUR";
  return /^[A-Z]{3}$/.test(s) ? s : "EUR";
}

export function normalizeInteger(input: string | number | null | undefined, opts: { min?: number; max?: number } = {}): number | null {
  if (input === null || input === undefined) return null;
  let n: number;
  if (typeof input === "number") n = input;
  else {
    const m = input.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    n = Number(m[0]);
  }
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (opts.min !== undefined && r < opts.min) return null;
  if (opts.max !== undefined && r > opts.max) return null;
  return r;
}

export function normalizeSurface(input: string | number | null | undefined): number | null {
  // "145 m²", "145m2", "145", 145 → 145; ignore absurd values
  return normalizeInteger(input, { min: 5, max: 100000 });
}

export function normalizeBedrooms(input: string | number | null | undefined): number | null {
  return normalizeInteger(input, { min: 0, max: 50 });
}

export function normalizeCoordinate(input: string | number | null | undefined, kind: "lat" | "lng"): number | null {
  if (input === null || input === undefined) return null;
  const n = typeof input === "number" ? input : Number(String(input).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const limit = kind === "lat" ? 90 : 180;
  return Math.abs(n) <= limit ? n : null;
}

/** Normalize Belgian (and generic international) phone numbers to E.164. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s.\-()/]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    // "+320478..." → strip trunk 0 after country code 32
    if (digits.startsWith("320")) return "+32" + digits.slice(3);
    return "+" + digits;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) {
    return "+32" + digits.slice(1);
  }
  if (digits.startsWith("32") && digits.length >= 10) return "+" + digits;
  return null;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // Remove common tracking parameters
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function normalizeTimestamp(input: string | Date | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input < 1e12 ? input * 1000 : input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = input.trim();
  // dd/mm/yyyy or dd-mm-yyyy (Belgian formats)
  const be = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (be) {
    const [, d, m, y, hh, mm] = be;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeListingType(input: string | null | undefined): ListingType {
  const s = (input ?? "").toLowerCase();
  if (/rent|huur|louer|location|verhuur/.test(s)) return "RENT";
  return "SALE";
}

export function normalizePropertyType(input: string | null | undefined): PropertyType {
  const s = foldText(input) ?? "";
  if (!s) return "UNKNOWN";
  if (/appart|flat|studio|penthouse|duplex|loft/.test(s)) return "APARTMENT";
  if (/huis|house|villa|woning|maison|bungalow|rijwoning|hoeve|herenhuis|fermette|chalet/.test(s)) return "HOUSE";
  if (/grond|land|terrain|bouwgrond|perceel/.test(s)) return "LAND";
  if (/commerc|handel|kantoor|office|bureau|winkel|shop|magazijn|warehouse|industri|horeca/.test(s)) return "COMMERCIAL";
  if (/garage|parking|other|andere|autre/.test(s)) return "OTHER";
  return "UNKNOWN";
}

export function normalizeSellerTypeHint(input: string | null | undefined): SellerType | null {
  const s = foldText(input) ?? "";
  if (!s) return null;
  if (/private|particulier|owner|eigenaar|proprietaire/.test(s)) return "PRIVATE";
  if (/agency|agent|makelaar|professional|pro|immo|agence/.test(s)) return "PROFESSIONAL";
  return null;
}

export function normalizeStatus(input: string | null | undefined): "ACTIVE" | "REMOVED" {
  const s = (input ?? "").toLowerCase();
  if (/removed|sold|verkocht|vendu|inactive|offline|verwijderd|expired|verhuurd|rented|withdrawn/.test(s)) return "REMOVED";
  return "ACTIVE";
}

const STREET_ABBREVIATIONS: Array<[RegExp, string]> = [
  // Dutch suffix abbreviations glued to the street name: "Veldstr" → "veldstraat"
  [/(?<=\p{L})stwg\b/gu, "steenweg"],
  [/(?<=\p{L})stw\b/gu, "steenweg"],
  [/(?<=\p{L})str\b/gu, "straat"],
  [/(?<=\p{L})ln\b/gu, "laan"],
  // Standalone abbreviations: "Av. Louise", "Bd. Anspach", "Pl. Sint-Jacobs"
  [/\bstr\b/g, "straat"],
  [/\bstwg\b/g, "steenweg"],
  [/\bav\b/g, "avenue"],
  [/\bbd\b/g, "boulevard"],
  [/\bpl\b/g, "plein"],
  [/\bst(?=[\s-])/g, "sint"],
];

export function normalizeStreet(input: string | null | undefined): string | null {
  let s = foldText(input);
  if (!s) return null;
  for (const [re, rep] of STREET_ABBREVIATIONS) s = s.replace(re, rep);
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeHouseNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d+)([a-z]?)/);
  if (!m) return null;
  return `${Number(m[1])}${m[2] ?? ""}`;
}

export interface ParsedAddress {
  street: string | null;
  houseNumber: string | null;
  boxNumber: string | null;
  postalCode: string | null;
  city: string | null;
}

/**
 * Parse a free-form Belgian address line such as:
 *  "Kortrijksesteenweg 123 bus 4, 9000 Gent"
 *  "Rue de la Loi 16, 1000 Bruxelles"
 *  "Veldstraat 12A 9000 Gent"
 */
export function parseAddressLine(line: string | null | undefined): ParsedAddress {
  const empty: ParsedAddress = { street: null, houseNumber: null, boxNumber: null, postalCode: null, city: null };
  if (!line) return empty;
  let s = line.replace(/\s+/g, " ").trim();
  let postalCode: string | null = null;
  let city: string | null = null;
  const pc = s.match(/\b(?:b-?)?(\d{4})\b\s*([\p{L}\s'.-]+)?$/iu);
  if (pc) {
    postalCode = normalizePostalCode(pc[1] ?? null);
    city = pc[2]?.trim().replace(/^,\s*/, "") || null;
    s = s.slice(0, pc.index).replace(/[,\s]+$/, "");
  }
  let boxNumber: string | null = null;
  const box = s.match(/\b(?:bus|box|bte|boite|boîte|b)\s*([0-9a-z]+)$/i);
  if (box) {
    boxNumber = (box[1] ?? "").toLowerCase();
    s = s.slice(0, box.index).trim().replace(/[,\s]+$/, "");
  }
  let houseNumber: string | null = null;
  const num = s.match(/^(.*?)[,\s]+(\d+\s?[a-z]?(?:[/-]\d+)?)$/i);
  let street: string | null;
  if (num) {
    street = num[1] ?? null;
    houseNumber = normalizeHouseNumber((num[2] ?? "").split(/[/-]/)[0] ?? null);
  } else {
    // "12 Rue de la Loi" (number first)
    const numFirst = s.match(/^(\d+\s?[a-z]?)[,\s]+(.+)$/i);
    if (numFirst) {
      houseNumber = normalizeHouseNumber(numFirst[1] ?? null);
      street = numFirst[2] ?? null;
    } else {
      street = s || null;
    }
  }
  return { street: street ? street.replace(/,$/, "").trim() : null, houseNumber, boxNumber, postalCode, city };
}

export function buildAddressKey(street: string | null, houseNumber: string | null, postalCode: string | null): string | null {
  if (!street || !houseNumber || !postalCode) return null;
  return `${normalizeStreet(street)}|${normalizeHouseNumber(houseNumber)}|${postalCode}`;
}

export interface AddressInput {
  address?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  boxNumber?: string | null;
  postalCode?: string | number | null;
  city?: string | null;
  province?: string | null;
}

export function normalizeAddress(input: AddressInput): {
  addressLine: string | null;
  street: string | null;
  houseNumber: string | null;
  boxNumber: string | null;
  postalCode: string | null;
  city: string | null;
  municipality: string | null;
  province: string | null;
  addressKey: string | null;
} {
  const parsed = parseAddressLine(input.address);
  const streetRaw = input.street?.trim() || parsed.street;
  const street = normalizeStreet(streetRaw);
  const houseNumber = normalizeHouseNumber(input.houseNumber) ?? parsed.houseNumber;
  const boxNumber = input.boxNumber?.trim().toLowerCase() || parsed.boxNumber;
  const postalCode = normalizePostalCode(input.postalCode ?? null) ?? parsed.postalCode;
  const cityRaw = input.city?.trim() || parsed.city;
  const municipality = municipalityForPostalCode(postalCode) ?? canonicalCityName(cityRaw);
  const city = canonicalCityName(cityRaw) ?? municipality;
  const province = canonicalProvince(input.province ?? null) ?? provinceForPostalCode(postalCode);
  const addressKey = buildAddressKey(street, houseNumber, postalCode);
  const streetDisplay = streetRaw ? streetRaw.trim() : null;
  const addressLine =
    [streetDisplay && houseNumber ? `${streetDisplay} ${houseNumber}${boxNumber ? ` bus ${boxNumber}` : ""}` : streetDisplay, [postalCode, city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || null;
  return { addressLine, street, houseNumber, boxNumber, postalCode, city, municipality, province, addressKey };
}

/** "Pieter Janssens" / "JANSSENS Pieter" → "janssens pieter" (sorted tokens) */
export function normalizePersonName(first: string | null | undefined, last?: string | null | undefined): string | null {
  const joined = [first, last].filter(Boolean).join(" ");
  const folded = foldText(joined);
  if (!folded) return null;
  const tokens = folded
    .split(" ")
    .filter((t) => t.length > 0 && !["mr", "mrs", "dhr", "mevr", "mme", "m", "de heer", "mevrouw"].includes(t));
  if (!tokens.length) return null;
  return tokens.sort().join(" ");
}
