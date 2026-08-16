/** Belgian geographic reference data used by normalization and matching. */

/** Postal code prefix → province (NIS-style ranges). */
export function provinceForPostalCode(postalCode: string): string | null {
  const pc = parseInt(postalCode, 10);
  if (Number.isNaN(pc) || pc < 1000 || pc > 9999) return null;
  if (pc >= 1000 && pc <= 1299) return "brussel";
  if (pc >= 1300 && pc <= 1499) return "waals-brabant";
  if (pc >= 1500 && pc <= 1999) return "vlaams-brabant";
  if (pc >= 3000 && pc <= 3499) return "vlaams-brabant";
  if (pc >= 2000 && pc <= 2999) return "antwerpen";
  if (pc >= 3500 && pc <= 3999) return "limburg";
  if (pc >= 4000 && pc <= 4999) return "luik";
  if (pc >= 5000 && pc <= 5999) return "namen";
  if (pc >= 6000 && pc <= 6599) return "henegouwen";
  if (pc >= 7000 && pc <= 7999) return "henegouwen";
  if (pc >= 6600 && pc <= 6999) return "luxemburg";
  if (pc >= 8000 && pc <= 8999) return "west-vlaanderen";
  if (pc >= 9000 && pc <= 9999) return "oost-vlaanderen";
  return null;
}

/** Common municipality spelling variants → canonical lowercase Dutch/French name. */
const MUNICIPALITY_ALIASES: Record<string, string> = {
  gand: "gent",
  ghent: "gent",
  anvers: "antwerpen",
  antwerp: "antwerpen",
  bruxelles: "brussel",
  brussels: "brussel",
  bruges: "brugge",
  louvain: "leuven",
  malines: "mechelen",
  ostende: "oostende",
  ostend: "oostende",
  courtrai: "kortrijk",
  "st-niklaas": "sint-niklaas",
  "st niklaas": "sint-niklaas",
  liege: "luik",
  "liège": "luik",
  namur: "namen",
  mons: "bergen",
};

export function normalizeMunicipality(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
  if (cleaned === "") return null;
  return MUNICIPALITY_ALIASES[cleaned] ?? cleaned;
}

export function isValidBelgianPostalCode(value: string): boolean {
  return /^[1-9]\d{3}$/.test(value);
}
