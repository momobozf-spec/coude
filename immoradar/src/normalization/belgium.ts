/**
 * Belgian reference data: postal-code → province mapping (by official ranges)
 * and a curated municipality lookup for common demo/production areas.
 * The lookup is intentionally small; unknown postal codes still get a
 * province and keep the city name reported by the source.
 */
export type Province =
  | "Brussels"
  | "Antwerpen"
  | "Limburg"
  | "Oost-Vlaanderen"
  | "West-Vlaanderen"
  | "Vlaams-Brabant"
  | "Waals-Brabant"
  | "Henegouwen"
  | "Luik"
  | "Luxemburg"
  | "Namen";

export function provinceForPostalCode(postalCode: string | null): Province | null {
  if (!postalCode) return null;
  const n = Number(postalCode);
  if (!Number.isInteger(n)) return null;
  if (n >= 1000 && n <= 1299) return "Brussels";
  if (n >= 1300 && n <= 1499) return "Waals-Brabant";
  if ((n >= 1500 && n <= 1999) || (n >= 3000 && n <= 3499)) return "Vlaams-Brabant";
  if (n >= 2000 && n <= 2999) return "Antwerpen";
  if (n >= 3500 && n <= 3999) return "Limburg";
  if (n >= 4000 && n <= 4999) return "Luik";
  if (n >= 5000 && n <= 5999) return "Namen";
  if ((n >= 6000 && n <= 6599) || (n >= 7000 && n <= 7999)) return "Henegouwen";
  if (n >= 6600 && n <= 6999) return "Luxemburg";
  if (n >= 8000 && n <= 8999) return "West-Vlaanderen";
  if (n >= 9000 && n <= 9999) return "Oost-Vlaanderen";
  return null;
}

/** Sub-municipality / postal code → main municipality. */
const MUNICIPALITIES: Record<string, string> = {
  "1000": "Brussel",
  "1050": "Elsene",
  "1060": "Sint-Gillis",
  "1180": "Ukkel",
  "1200": "Sint-Lambrechts-Woluwe",
  "2000": "Antwerpen",
  "2018": "Antwerpen",
  "2020": "Antwerpen",
  "2030": "Antwerpen",
  "2050": "Antwerpen",
  "2060": "Antwerpen",
  "2100": "Antwerpen",
  "2140": "Antwerpen",
  "2170": "Antwerpen",
  "2180": "Antwerpen",
  "2600": "Antwerpen",
  "2610": "Antwerpen",
  "2640": "Mortsel",
  "2650": "Edegem",
  "2800": "Mechelen",
  "2900": "Schoten",
  "2930": "Brasschaat",
  "3000": "Leuven",
  "3001": "Leuven",
  "3010": "Leuven",
  "3500": "Hasselt",
  "3600": "Genk",
  "3700": "Tongeren",
  "8000": "Brugge",
  "8200": "Brugge",
  "8310": "Brugge",
  "8400": "Oostende",
  "8500": "Kortrijk",
  "8800": "Roeselare",
  "9000": "Gent",
  "9030": "Gent",
  "9031": "Gent",
  "9032": "Gent",
  "9040": "Gent",
  "9041": "Gent",
  "9042": "Gent",
  "9050": "Gent",
  "9051": "Gent",
  "9052": "Gent",
  "9070": "Destelbergen",
  "9090": "Melle",
  "9100": "Sint-Niklaas",
  "9120": "Beveren",
  "9160": "Lokeren",
  "9200": "Dendermonde",
  "9300": "Aalst",
  "9400": "Ninove",
  "9600": "Ronse",
  "9700": "Oudenaarde",
  "9800": "Deinze",
  "9820": "Merelbeke",
  "9830": "Sint-Martens-Latem",
  "9840": "De Pinte",
  "9880": "Aalter",
  "9900": "Eeklo",
};

const CITY_ALIASES: Record<string, string> = {
  gand: "Gent",
  ghent: "Gent",
  anvers: "Antwerpen",
  antwerp: "Antwerpen",
  bruxelles: "Brussel",
  brussels: "Brussel",
  bruges: "Brugge",
  louvain: "Leuven",
  ostende: "Oostende",
  ostend: "Oostende",
  courtrai: "Kortrijk",
  malines: "Mechelen",
  "st-niklaas": "Sint-Niklaas",
  "sint niklaas": "Sint-Niklaas",
  "st.-niklaas": "Sint-Niklaas",
  "alost": "Aalst",
  "audenarde": "Oudenaarde",
};

export function municipalityForPostalCode(postalCode: string | null): string | null {
  if (!postalCode) return null;
  return MUNICIPALITIES[postalCode] ?? null;
}

export function canonicalCityName(city: string | null): string | null {
  if (!city) return null;
  const trimmed = city.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const alias = CITY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  // Title-case with hyphen support: "sint-martens-latem" → "Sint-Martens-Latem"
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
        .join("-"),
    )
    .join(" ");
}

export const BELGIAN_PROVINCES: Province[] = [
  "Brussels",
  "Antwerpen",
  "Limburg",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Vlaams-Brabant",
  "Waals-Brabant",
  "Henegouwen",
  "Luik",
  "Luxemburg",
  "Namen",
];

const PROVINCE_ALIASES: Record<string, Province> = {
  "east flanders": "Oost-Vlaanderen",
  "flandre orientale": "Oost-Vlaanderen",
  "oost vlaanderen": "Oost-Vlaanderen",
  "west flanders": "West-Vlaanderen",
  "flandre occidentale": "West-Vlaanderen",
  "west vlaanderen": "West-Vlaanderen",
  antwerp: "Antwerpen",
  anvers: "Antwerpen",
  "flemish brabant": "Vlaams-Brabant",
  "brabant flamand": "Vlaams-Brabant",
  "vlaams brabant": "Vlaams-Brabant",
  "walloon brabant": "Waals-Brabant",
  "brabant wallon": "Waals-Brabant",
  hainaut: "Henegouwen",
  liege: "Luik",
  liège: "Luik",
  luxembourg: "Luxemburg",
  namur: "Namen",
  brussel: "Brussels",
  bruxelles: "Brussels",
  "brussels capital region": "Brussels",
};

export function canonicalProvince(input: string | null): Province | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  const alias = PROVINCE_ALIASES[key];
  if (alias) return alias;
  const direct = BELGIAN_PROVINCES.find((p) => p.toLowerCase() === key);
  return direct ?? null;
}
