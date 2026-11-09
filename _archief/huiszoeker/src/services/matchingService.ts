/**
 * De matching engine.
 *
 * Deze beoordeelt elk pand opnieuw tegen de opgeslagen criteria, ongeacht wat
 * de bron zelf gefilterd zou hebben. Dat is niet dubbel werk: sitefilters zijn
 * inconsistent, robots.txt verbiedt ze bij Immoweb sowieso, en een bron die zijn
 * filterlogica wijzigt mag onze resultaten niet stilletjes veranderen.
 *
 * Drie regels sturen alles hieronder:
 *
 *  1. HARD FAALT ⇒ GEEN MATCH. Eén gefaalde harde eis en het pand wordt niet
 *     gemeld, hoe goed de rest ook is.
 *  2. ONBEKEND ≠ ONWAAR. Een advertentie zonder EPC-vermelding is niet een
 *     advertentie met EPC F. Bij een voorkeur telt onbekend niet mee in de
 *     noemer van de score; bij een harde eis is het wél een fail, want daar is
 *     de gebruiker expliciet over geweest.
 *  3. ELKE UITKOMST KRIJGT EEN REDEN. De `MatchReason[]` is wat de melding
 *     toont, wat het dashboard toont, en de enige input die de AI krijgt. Er is
 *     geen pad waarlangs een score ontstaat zonder uitleg.
 */
import { epcSatisfies, worstAccepted } from "../lib/epc.js";
import type { Constraints, SearchCriteria } from "../schemas/searchCriteria.js";
import type { MatchReason, MatchResult, MatchVerdict } from "../types/matching.js";
import type { PropertyRecord } from "../types/domain.js";
import type { CriteriaField } from "../schemas/searchCriteria.js";

/** Het pand zoals de engine het ziet — werkt zowel op een DB-record als op een
 *  vers genormaliseerde advertentie. */
export interface MatchableProperty {
  title: string;
  description?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
  region?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  livingAreaM2?: number | null;
  landAreaM2?: number | null;
  epcLabel?: string | null;
  features?: string[] | null;
}

export function toMatchable(property: PropertyRecord): MatchableProperty {
  return {
    ...property,
    transactionType: property.transactionType === "RENT" ? "rent" : "buy",
  };
}

class ReasonCollector {
  readonly reasons: MatchReason[] = [];

  add(field: CriteriaField, verdict: MatchVerdict, hard: boolean, detail: string, weight = 1): void {
    this.reasons.push({ field, verdict, hard, detail, weight });
  }
}

/** Diakrieten en interpunctie weg, zodat "Liège" en "Liege" hetzelfde zijn. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vrije tekst — voor keywords, nooit voor locatie. */
function haystack(property: MatchableProperty): string {
  return fold([property.title, property.description, property.address, property.city].filter(Boolean).join(" "));
}

/**
 * Alleen de gestructureerde adresvelden.
 *
 * Locatie mág niet tegen titel en beschrijving gematcht worden. Een advertentie
 * voor een woning in Aalst met "op tien minuten van Gent" in de tekst zou
 * anders als Gent tellen — en dat is precies het soort stille fout dat een
 * gebruiker maanden verkeerde meldingen oplevert zonder dat hij begrijpt waarom.
 */
function locationHaystack(property: MatchableProperty): string {
  return fold([property.city, property.region, property.address].filter(Boolean).join(" "));
}

function formatEuro(value: number): string {
  return `€${value.toLocaleString("nl-BE")}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Scope: altijd hard
   ──────────────────────────────────────────────────────────────────────────── */

function evaluateTransactionType(property: MatchableProperty, criteria: SearchCriteria, out: ReasonCollector): void {
  const actual = property.transactionType ?? "buy";
  const wanted = criteria.transactionType;
  const label = wanted === "rent" ? "te huur" : "te koop";

  if (actual === wanted) {
    out.add("transactionType", "pass", true, `${label}`);
  } else {
    out.add("transactionType", "fail", true, `Dit pand is niet ${label}`);
  }
}

/**
 * Locatie.
 *
 * BEPERKING, expliciet: zonder geocoding kunnen we een straal in kilometers niet
 * verifiëren. Wat we wél doen is dit: zonder `radiusKm` is een niet-passende
 * plaats een harde fail; mét `radiusKm` wordt hij `unknown` in plaats van
 * `fail`, want de gebruiker heeft dan zelf gezegd dat de omgeving ook goed is.
 * Zo blokkeren we geen buurgemeente die we niet kunnen narekenen, en doen we
 * ook niet alsof we een afstand kennen die we niet kennen. Echte afstands-
 * filtering vraagt een geocoder — dat is bewust uitgesteld.
 */
function evaluateLocation(property: MatchableProperty, criteria: SearchCriteria, out: ReasonCollector): void {
  const wantedPlaces = criteria.locations ?? [];
  const wantedPostcodes = criteria.postalCodes ?? [];
  if (wantedPlaces.length === 0 && wantedPostcodes.length === 0) return;

  const propertyPostcode = property.postalCode ?? "";
  const text = locationHaystack(property);

  const postcodeHit = wantedPostcodes.some((p) => p === propertyPostcode);
  const placeHit = wantedPlaces.some((p) => {
    const folded = fold(p);
    return folded.length > 0 && text.includes(folded);
  });

  const field: CriteriaField = wantedPlaces.length > 0 ? "locations" : "postalCodes";
  const wantedLabel = [...wantedPlaces, ...wantedPostcodes].join(" of ");

  if (postcodeHit || placeHit) {
    out.add(field, "pass", true, `Ligt in ${property.city ?? (propertyPostcode || wantedLabel)}`);
    return;
  }

  if (criteria.radiusKm !== undefined) {
    // Regionale nabijheid via de eerste twee cijfers van de postcode. Belgische
    // postcodes zijn geografisch geordend, dus dit is een echte aanwijzing —
    // maar geen afstand, en zo wordt het ook gerapporteerd.
    const sameRegion =
      propertyPostcode.length === 4 &&
      wantedPostcodes.some((p) => p.slice(0, 2) === propertyPostcode.slice(0, 2));

    out.add(
      field,
      sameRegion ? "pass" : "unknown",
      true,
      `${property.city ?? "Onbekende plaats"} — je zocht binnen ${criteria.radiusKm} km van ${wantedLabel}; de exacte afstand is niet nagerekend`,
    );
    return;
  }

  out.add(field, "fail", true, `Ligt in ${property.city ?? "een andere plaats"}, niet in ${wantedLabel}`);
}

/* ────────────────────────────────────────────────────────────────────────────
   Constraints: per groep hard of voorkeur
   ──────────────────────────────────────────────────────────────────────────── */

function evaluateConstraints(
  property: MatchableProperty,
  constraints: Constraints,
  hard: boolean,
  out: ReasonCollector,
): void {
  const text = haystack(property);
  const features = new Set((property.features ?? []).map((f) => f.toLowerCase()));

  if (constraints.propertyTypes?.length) {
    const actual = property.propertyType;
    if (!actual) {
      out.add("propertyTypes", "unknown", hard, "Het woningtype staat niet in de advertentie");
    } else if (constraints.propertyTypes.includes(actual as never)) {
      out.add("propertyTypes", "pass", hard, `Type: ${actual}`);
    } else {
      out.add("propertyTypes", "fail", hard, `Type is ${actual}, je zocht ${constraints.propertyTypes.join(" of ")}`);
    }
  }

  if (constraints.maxPrice !== undefined) {
    const price = property.price;
    if (price === null || price === undefined) {
      out.add("maxPrice", "unknown", hard, "De prijs staat niet in de advertentie");
    } else if (price <= constraints.maxPrice) {
      const diff = constraints.maxPrice - price;
      out.add(
        "maxPrice",
        "pass",
        hard,
        diff > 0 ? `${formatEuro(diff)} onder je maximumbudget` : "Precies je maximumbudget",
      );
    } else {
      out.add("maxPrice", "fail", hard, `${formatEuro(price - constraints.maxPrice)} boven je maximumbudget`);
    }
  }

  if (constraints.minPrice !== undefined) {
    const price = property.price;
    if (price === null || price === undefined) {
      out.add("minPrice", "unknown", hard, "De prijs staat niet in de advertentie");
    } else if (price >= constraints.minPrice) {
      out.add("minPrice", "pass", hard, `Boven je ondergrens van ${formatEuro(constraints.minPrice)}`);
    } else {
      out.add("minPrice", "fail", hard, `Onder je ondergrens van ${formatEuro(constraints.minPrice)}`);
    }
  }

  evaluateMinimum(constraints.minBedrooms, property.bedrooms, "minBedrooms", "slaapkamers", hard, out);
  evaluateMinimum(constraints.minBathrooms, property.bathrooms, "minBathrooms", "badkamers", hard, out);
  evaluateMinimum(constraints.minSurfaceM2, property.livingAreaM2, "minSurfaceM2", "m² bewoonbaar", hard, out);
  evaluateMinimum(constraints.minLandSurfaceM2, property.landAreaM2, "minLandSurfaceM2", "m² grond", hard, out);

  if (constraints.epcLabels?.length) {
    const satisfied = epcSatisfies(property.epcLabel, constraints.epcLabels);
    const threshold = worstAccepted(constraints.epcLabels);
    if (satisfied === undefined) {
      out.add("epcLabels", "unknown", hard, "Geen EPC-label vermeld in de advertentie");
    } else if (satisfied) {
      out.add("epcLabels", "pass", hard, `EPC ${property.epcLabel}`);
    } else {
      out.add("epcLabels", "fail", hard, `EPC ${property.epcLabel}, je zocht ${threshold} of beter`);
    }
  }

  // Features krijgen elk hun eigen reden. Anders zou "tuin ja, garage nee" één
  // vage 'gedeeltelijk'-uitkomst worden en zou de melding niet kunnen tonen
  // wát er ontbreekt.
  for (const feature of constraints.features ?? []) {
    if (features.has(feature)) {
      out.add("features", "pass", hard, FEATURE_LABELS[feature] ?? feature);
    } else if (features.size === 0) {
      out.add("features", "unknown", hard, `Geen kenmerken vermeld, dus ${FEATURE_LABELS[feature] ?? feature} onbekend`);
    } else {
      out.add("features", "fail", hard, `Geen ${FEATURE_LABELS[feature] ?? feature} vermeld`);
    }
  }

  for (const keyword of constraints.keywords ?? []) {
    const folded = fold(keyword);
    if (folded && text.includes(folded)) {
      out.add("keywords", "pass", hard, `Advertentie vermeldt "${keyword}"`);
    } else {
      out.add("keywords", "fail", hard, `Advertentie vermeldt "${keyword}" niet`);
    }
  }

  for (const keyword of constraints.excludedKeywords ?? []) {
    const folded = fold(keyword);
    if (folded && text.includes(folded)) {
      out.add("excludedKeywords", "fail", hard, `Advertentie vermeldt "${keyword}", dat wilde je uitsluiten`);
    } else {
      out.add("excludedKeywords", "pass", hard, `Bevat "${keyword}" niet`);
    }
  }
}

function evaluateMinimum(
  wanted: number | undefined,
  actual: number | null | undefined,
  field: CriteriaField,
  unit: string,
  hard: boolean,
  out: ReasonCollector,
): void {
  if (wanted === undefined) return;
  if (actual === null || actual === undefined) {
    out.add(field, "unknown", hard, `Aantal ${unit} niet vermeld`);
    return;
  }
  if (actual >= wanted) {
    out.add(field, "pass", hard, `${actual} ${unit}`);
  } else {
    out.add(field, "fail", hard, `${actual} ${unit}, je zocht er minstens ${wanted}`);
  }
}

const FEATURE_LABELS: Record<string, string> = {
  garden: "tuin",
  garage: "garage",
  parking: "parkeerplaats",
  terrace: "terras",
  balcony: "balkon",
  elevator: "lift",
  swimming_pool: "zwembad",
  cellar: "kelder",
  attic: "zolder",
  fireplace: "open haard",
  solar_panels: "zonnepanelen",
  heat_pump: "warmtepomp",
  air_conditioning: "airco",
  detached: "vrijstaand",
  semi_detached: "halfopen bebouwing",
  renovated: "gerenoveerd",
  new_build: "nieuwbouw",
  furnished: "gemeubeld",
  accessible: "toegankelijk",
};

/* ────────────────────────────────────────────────────────────────────────────
   Publieke API
   ──────────────────────────────────────────────────────────────────────────── */

export function matchesCriteria(property: MatchableProperty, criteria: SearchCriteria): MatchResult {
  const out = new ReasonCollector();

  evaluateTransactionType(property, criteria, out);
  evaluateLocation(property, criteria, out);
  evaluateConstraints(property, criteria.hardRequirements, true, out);
  evaluateConstraints(property, criteria.preferences, false, out);

  // Een harde eis die faalt blokkeert. Een harde eis die 'unknown' is blokkeert
  // óók — behalve de locatie-met-straal, die hierboven bewust als 'unknown'
  // wordt gerapporteerd en die we niet als afwijzing willen behandelen.
  const hardPass = !out.reasons.some(
    (r) => r.hard && (r.verdict === "fail" || (r.verdict === "unknown" && !isRadiusLocation(r, criteria))),
  );

  const preferences = out.reasons.filter((r) => !r.hard && r.verdict !== "unknown");
  const totalWeight = preferences.reduce((sum, r) => sum + r.weight, 0);
  const earned = preferences.filter((r) => r.verdict === "pass").reduce((sum, r) => sum + r.weight, 0);

  // Geen (beoordeelbare) voorkeuren betekent: het pand voldoet aan alles wat de
  // gebruiker gevraagd heeft. 100 is dan de eerlijke score, niet 0.
  const score = totalWeight === 0 ? 100 : Math.round((earned / totalWeight) * 100);

  return { hardPass, score, reasons: out.reasons };
}

function isRadiusLocation(reason: MatchReason, criteria: SearchCriteria): boolean {
  return (
    criteria.radiusKm !== undefined && (reason.field === "locations" || reason.field === "postalCodes")
  );
}

/** De redenen die een melding wil tonen: eerst wat goed is, dan de aandachtspunten. */
export function summarizeReasons(reasons: readonly MatchReason[]): {
  positives: MatchReason[];
  concerns: MatchReason[];
} {
  return {
    positives: reasons.filter((r) => r.verdict === "pass"),
    concerns: reasons.filter((r) => r.verdict !== "pass"),
  };
}
