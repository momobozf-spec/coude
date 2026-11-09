/**
 * JSON-LD van een Immoweb-detailpagina → ons interne formaat.
 *
 * Puur en synchroon, dus testbaar tegen opgeslagen snapshots zonder netwerk.
 * Dat is precies de test die de opdracht vraagt: "resultaten van verschillende
 * scrapers moeten hetzelfde PropertyListing-formaat opleveren".
 *
 * De regel bij twijfel: liever een veld leeg laten dan het verkeerd invullen.
 * Een ontbrekend EPC-label levert `unknown` op in de matching engine — een fout
 * label levert een verkeerde melding op, en dat is veel duurder.
 */
import type { JsonLdNode } from "../base/jsonld.js";
import { findByType, pick, pickNumber, pickString, typeList } from "../base/jsonld.js";
import { EPC_LABELS } from "../../schemas/searchCriteria.js";
import type { FEATURES, PROPERTY_TYPES } from "../../schemas/searchCriteria.js";

export interface ImmowebPayload {
  /** Alle JSON-LD-blokken van de detailpagina. */
  nodes: JsonLdNode[];
  /** Canonieke URL van de pagina. */
  url: string;
  externalId: string;
}

/** schema.org-types die een woning beschrijven. */
const PROPERTY_TYPES_LD = [
  "product",
  "residence",
  "singlefamilyresidence",
  "apartment",
  "house",
  "realestatelisting",
  "accommodation",
  "offer",
];

const TYPE_KEYWORDS: [RegExp, (typeof PROPERTY_TYPES)[number]][] = [
  [/\b(appartement|apartment|flat)\b/i, "apartment"],
  [/\b(villa)\b/i, "villa"],
  [/\b(studio)\b/i, "studio"],
  [/\b(penthouse)\b/i, "penthouse"],
  [/\b(duplex)\b/i, "duplex"],
  [/\b(loft)\b/i, "loft"],
  [/\b(bungalow)\b/i, "bungalow"],
  [/\b(hoeve|boerderij|farmhouse|ferme)\b/i, "farmhouse"],
  [/\b(bouwgrond|grond|terrain|land)\b/i, "land"],
  [/\b(handelspand|commercial|commerce|kantoor)\b/i, "commercial"],
  [/\b(garage|staanplaats|parking)\b/i, "garage"],
  [/\b(woning|huis|house|maison|rijwoning|eengezinswoning)\b/i, "house"],
];

const FEATURE_KEYWORDS: [RegExp, (typeof FEATURES)[number]][] = [
  [/\b(tuin|jardin|garden)\b/i, "garden"],
  [/\b(garage)\b/i, "garage"],
  [/\b(staanplaats|parkeerplaats|parking)\b/i, "parking"],
  [/\b(terras|terrasse|terrace)\b/i, "terrace"],
  [/\b(balkon|balcon|balcony)\b/i, "balcony"],
  [/\b(lift|ascenseur|elevator)\b/i, "elevator"],
  [/\b(zwembad|piscine|swimming pool)\b/i, "swimming_pool"],
  [/\b(kelder|cave|cellar)\b/i, "cellar"],
  [/\b(zolder|grenier|attic)\b/i, "attic"],
  [/\b(open haard|cheminee|fireplace)\b/i, "fireplace"],
  [/\b(zonnepanelen|panneaux solaires|solar panels)\b/i, "solar_panels"],
  [/\b(warmtepomp|pompe a chaleur|heat pump)\b/i, "heat_pump"],
  [/\b(airco|climatisation|air conditioning)\b/i, "air_conditioning"],
  [/\b(vrijstaand|open bebouwing|detached)\b/i, "detached"],
  [/\b(halfopen bebouwing|semi[- ]detached)\b/i, "semi_detached"],
  [/\b(gerenoveerd|renove|renovated)\b/i, "renovated"],
  [/\b(nieuwbouw|neuf|new build)\b/i, "new_build"],
  [/\b(gemeubeld|meuble|furnished)\b/i, "furnished"],
];

export function normalizeImmoweb(payload: ImmowebPayload): unknown {
  const { nodes, url, externalId } = payload;

  const main = findByType(nodes, ...PROPERTY_TYPES_LD) ?? nodes[0];
  if (!main) {
    throw new Error("Geen bruikbare JSON-LD op de pagina");
  }

  const title = pickString(main, "name", "headline");
  if (!title) {
    // Zonder titel is de rest niet te vertrouwen: dan hebben we waarschijnlijk
    // een navigatie- of organisatieblok te pakken in plaats van het pand.
    throw new Error("JSON-LD bevat geen titel");
  }

  const description = pickString(main, "description");
  const text = [title, description].filter(Boolean).join(" ");

  const price = pickNumber(main, "offers.price", "offers.priceSpecification.price", "price");
  const currency = pickString(main, "offers.priceCurrency", "offers.priceSpecification.priceCurrency");

  const listing = {
    externalId,
    source: "immoweb",
    url,
    title,
    description,

    address: pickString(main, "address.streetAddress"),
    postalCode: normalizePostalCode(pickString(main, "address.postalCode")),
    city: pickString(main, "address.addressLocality"),
    region: pickString(main, "address.addressRegion"),

    latitude: pickNumber(main, "geo.latitude"),
    longitude: pickNumber(main, "geo.longitude"),

    propertyType: detectPropertyType(main, text),
    transactionType: detectTransactionType(url, text),

    // Alleen euro's overnemen. Een bedrag in een andere munt zonder omrekening
    // opslaan zou elke prijsvergelijking stilletjes verkeerd maken.
    price: currency === undefined || currency.toUpperCase() === "EUR" ? roundOrUndefined(price) : undefined,

    bedrooms: roundOrUndefined(pickNumber(main, "numberOfBedrooms", "numberOfRooms")),
    bathrooms: roundOrUndefined(pickNumber(main, "numberOfBathroomsTotal", "numberOfBathrooms")),

    livingAreaM2: roundOrUndefined(pickNumber(main, "floorSize.value", "floorSize")),
    landAreaM2: roundOrUndefined(pickNumber(main, "lotSize.value", "lotSize")),

    epcLabel: detectEpcLabel(main, text),

    features: detectFeatures(main, text),

    imageUrl: pickString(main, "image.url", "image", "photo.url"),

    publishedAt: parseDate(pickString(main, "datePosted", "datePublished", "offers.availabilityStarts")),
    discoveredAt: new Date(),
  };

  return stripUndefined(listing);
}

function normalizePostalCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /\b(\d{4})\b/.exec(value);
  return match?.[1];
}

function roundOrUndefined(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : Math.round(value);
}

function detectPropertyType(node: JsonLdNode, text: string): string | undefined {
  // Eerst het expliciete schema.org-type; dat is betrouwbaarder dan tekst.
  const types = typeList(node);
  if (types.includes("apartment")) return "apartment";
  if (types.includes("singlefamilyresidence") || types.includes("house")) return "house";

  const category = pickString(node, "category", "additionalType") ?? "";
  for (const [pattern, type] of TYPE_KEYWORDS) {
    if (pattern.test(category)) return type;
  }
  for (const [pattern, type] of TYPE_KEYWORDS) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}

function detectTransactionType(url: string, text: string): "buy" | "rent" {
  if (/te-huur|a-louer|for-rent/i.test(url)) return "rent";
  if (/\b(te huur|à louer|a louer|for rent)\b/i.test(text)) return "rent";
  return "buy";
}

function detectEpcLabel(node: JsonLdNode, text: string): string | undefined {
  const explicit = pickString(node, "energyEfficiencyScaleMin", "energyRating", "energyEfficiencyRating");
  if (explicit) {
    const normalized = explicit.trim().toUpperCase();
    if ((EPC_LABELS as readonly string[]).includes(normalized)) return normalized;
  }
  // "EPC A+", "EPC: B", "energielabel C" — bewust een strak patroon, zodat een
  // losse hoofdletter A in de beschrijving geen EPC-label wordt.
  const match = /\b(?:epc|peb|energielabel|energy label)\s*[:=]?\s*(A\+{0,2}|[B-G])\b/i.exec(text);
  const label = match?.[1]?.toUpperCase();
  return label && (EPC_LABELS as readonly string[]).includes(label) ? label : undefined;
}

function detectFeatures(node: JsonLdNode, text: string): string[] {
  const found = new Set<string>();

  const amenities = pick(node, "amenityFeature");
  if (Array.isArray(amenities)) {
    for (const amenity of amenities) {
      const name = pickString(amenity as JsonLdNode, "name") ?? "";
      for (const [pattern, feature] of FEATURE_KEYWORDS) {
        if (pattern.test(name)) found.add(feature);
      }
    }
  }

  for (const [pattern, feature] of FEATURE_KEYWORDS) {
    if (pattern.test(text)) found.add(feature);
  }

  return [...found];
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out;
}
