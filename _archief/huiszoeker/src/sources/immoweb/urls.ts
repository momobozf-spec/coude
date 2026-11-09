/**
 * URL-opbouw voor Immoweb — de plek waar robots.txt het ontwerp bepaalt.
 *
 * Immoweb's robots.txt verbiedt onder meer:
 *
 *     Disallow: *maxprice*        Disallow: *minprice*
 *     Disallow: *orderBy*         Disallow: *searchByRooms*
 *     Disallow: *searchId*        Disallow: *countries=*
 *     Disallow: (elk pad) /nl/geavanceerd-zoeken/
 *
 * Dat zijn precies de query-parameters waarmee je normaal zou filteren. Daarom
 * bouwen we uitsluitend PAD-gebaseerde zoek-URL's — type, transactie, gemeente,
 * postcode — en laten we prijs, slaapkamers, EPC en oppervlakte over aan onze
 * eigen matching engine.
 *
 * Dat is geen verlies: de opdracht vroeg sowieso al om niet op sitefilters te
 * vertrouwen. Het kost wel meer opgehaalde pagina's, en dat is precies waarom
 * `SCRAPER_MAX_RESULTS_PER_RUN` en de snelheidsbeperking bestaan.
 *
 * De `page`-parameter staat niet in de disallow-lijst en wordt gebruikt voor
 * paginering. Elke gebouwde URL gaat hoe dan ook nog langs `RobotsPolicy`, dus
 * als Immoweb zijn regels aanscherpt, stopt de bron vanzelf in plaats van door
 * te gaan.
 */
import type { SearchCriteria } from "../../schemas/searchCriteria.js";

export const IMMOWEB_ORIGIN = "https://www.immoweb.be";

/** Pad-segment per woningtype. Types die Immoweb niet als segment kent, laten
 *  we weg: dan zoeken we breder en filtert onze eigen engine. */
const TYPE_SEGMENT: Record<string, string> = {
  house: "huis",
  apartment: "appartement",
  villa: "villa",
  studio: "studio",
  penthouse: "penthouse",
  duplex: "duplex",
  loft: "loft",
  bungalow: "bungalow",
  farmhouse: "hoeve",
  land: "grond",
  commercial: "handelspand",
  garage: "garage",
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * De zoek-URL's voor deze criteria. Meerdere plaatsen of types leveren
 * meerdere URL's op; die worden afzonderlijk (en gethrottled) opgehaald.
 */
export function buildSearchUrls(criteria: SearchCriteria, maxUrls = 6): string[] {
  const transaction = criteria.transactionType === "rent" ? "te-huur" : "te-koop";

  const types = (criteria.hardRequirements.propertyTypes ?? criteria.preferences.propertyTypes ?? [])
    .map((t) => TYPE_SEGMENT[t])
    .filter((t): t is string => t !== undefined);
  const typeSegments = types.length > 0 ? types : ["huis-en-appartement"];

  const places: { slug: string; postcode?: string }[] = [];
  for (const location of criteria.locations ?? []) {
    const slug = slugify(location);
    if (slug) places.push({ slug });
  }
  for (const postcode of criteria.postalCodes ?? []) {
    places.push({ slug: "", postcode });
  }

  const urls: string[] = [];

  for (const type of typeSegments) {
    if (places.length === 0) {
      urls.push(`${IMMOWEB_ORIGIN}/nl/zoekertjes/${type}/${transaction}`);
      continue;
    }
    for (const place of places) {
      const parts = [`${IMMOWEB_ORIGIN}/nl/zoekertjes/${type}/${transaction}`];
      if (place.slug) parts.push(place.slug);
      if (place.postcode) parts.push(place.postcode);
      urls.push(parts.join("/"));
    }
  }

  return urls.slice(0, maxUrls);
}

/** Paginering via de enige parameter die robots.txt niet verbiedt. */
export function withPage(url: string, page: number): string {
  if (page <= 1) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

/**
 * Detailpagina's van Immoweb hebben een stabiele, in de sitemap gepubliceerde
 * vorm: `/nl/zoekertje/<slug>/<id>`. Het laatste numerieke segment is het
 * externalId.
 */
// Het aantal tussenliggende segmenten varieert (type, transactie, gemeente,
// postcode), dus die zijn bewust open gelaten. Het advertentie-id is altijd het
// laatste, numerieke segment. De trailing slash na "zoekertje" voorkomt dat
// "zoekertjes" (de zoekpagina, meervoud) ook matcht.
const DETAIL_PATH = /\/(?:nl|fr|en)\/(?:zoekertje|annonce|classified)\/(?:[^/?#]+\/)+(\d+)(?:[/?#]|$)/;

export function isDetailUrl(url: string): boolean {
  return DETAIL_PATH.test(url);
}

export function externalIdFromUrl(url: string): string | undefined {
  return DETAIL_PATH.exec(url)?.[1];
}

export function absoluteUrl(href: string): string | undefined {
  try {
    return new URL(href, IMMOWEB_ORIGIN).toString();
  } catch {
    return undefined;
  }
}
