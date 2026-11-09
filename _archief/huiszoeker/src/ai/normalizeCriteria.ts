/**
 * Deterministische opschoning van modeloutput, vóór Zod-validatie.
 *
 * Waarom deze laag bestaat: een model dat inhoudelijk gelijk heeft maar
 * "450k" schrijft in plaats van 450000, of "GARDEN" in plaats van "garden",
 * zou anders op een validatiefout stuklopen. Dat is verspilde tokens en een
 * slechtere gebruikerservaring voor een probleem dat we hier in twintig regels
 * exact oplossen.
 *
 * Wat deze laag NIET doet is criteria verzinnen of raden. Een waarde die na
 * opschoning nog steeds niet in het schema past, valt weg of laat de validatie
 * falen — precies zoals bedoeld. Opschonen is geen interpreteren.
 *
 * Alles hier is puur en synchroon, en daarmee zonder AI-aanroep te testen.
 */
import {
  CONSTRAINT_FIELDS,
  EPC_LABELS,
  FEATURES,
  PROPERTY_TYPES,
  TRANSACTION_TYPES,
} from "../schemas/searchCriteria.js";

const MILLION = /\b(m|mio|mln|miljoen|million|millions)\b|(?<=\d)\s*(m|mio|mln)\b/;
const THOUSAND_SUFFIX = /(?<=[\d,.])\s*k\b/;

/**
 * Zet een bedrag uit vrije tekst om naar hele euro's.
 * Ondersteunt "450k", "450.000", "450 000", "€450000", "450.000 euro",
 * "1,2 miljoen", "EUR 1.2 million".
 * Geeft `undefined` bij iets onherkenbaars — nooit een gok.
 */
export function parseAmount(input: unknown): number | undefined {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input) : undefined;
  }
  if (typeof input !== "string") return undefined;

  // Alle niet-cijfers sneuvelen verderop toch, inclusief harde spaties.
  const lowered = input.toLowerCase().trim();
  if (lowered === "") return undefined;

  let multiplier = 1;
  if (MILLION.test(lowered)) multiplier = 1_000_000;
  else if (THOUSAND_SUFFIX.test(lowered)) multiplier = 1_000;

  // Alleen cijfers en scheidingstekens overhouden.
  let digits = lowered.replace(/[^\d.,]/g, "");
  if (digits === "") return undefined;

  // Punt gevolgd door precies drie cijfers is een duizendtalscheiding.
  digits = digits.replace(/\.(?=\d{3}\b)/g, "");
  // Komma gevolgd door precies drie cijfers ook.
  digits = digits.replace(/,(?=\d{3}\b)/g, "");
  // Een resterende komma is een decimaalteken.
  digits = digits.replace(",", ".");

  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value) || value < 0) return undefined;

  return Math.round(value * multiplier);
}

function asStringArray(value: unknown): string[] | undefined {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string");
  return out.length > 0 ? out : undefined;
}

/** Dedupliceert case-insensitive maar behoudt de eerste schrijfwijze. */
function unique<T>(values: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    const key = typeof v === "string" ? v.toLowerCase() : JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Houdt alleen waarden die letterlijk in de toegestane lijst staan. */
function toEnumArray(value: unknown, allowed: readonly string[]): string[] | undefined {
  const raw = asStringArray(value);
  if (!raw) return undefined;
  const lower = new Map(allowed.map((a) => [a.toLowerCase(), a]));
  const mapped = raw
    .map((v) => lower.get(v.trim().toLowerCase()))
    .filter((v): v is string => v !== undefined);
  const out = unique(mapped);
  return out.length > 0 ? out : undefined;
}

function toInt(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (typeof value !== "string") return undefined;
  const n = Number.parseFloat(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function toPostalCodes(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : value === undefined ? undefined : [value];
  if (!raw) return undefined;
  const out = unique(
    raw
      .map((v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : ""))
      .filter((v) => /^\d{4}$/.test(v)),
  );
  return out.length > 0 ? out : undefined;
}

function toTextArray(value: unknown): string[] | undefined {
  const raw = asStringArray(value);
  if (!raw) return undefined;
  const out = unique(raw.map((v) => v.trim()).filter((v) => v.length > 0));
  return out.length > 0 ? out : undefined;
}

const AMOUNT_FIELDS = new Set(["minPrice", "maxPrice"]);
const INT_FIELDS = new Set([
  "minBedrooms",
  "minBathrooms",
  "minSurfaceM2",
  "minLandSurfaceM2",
]);

const ARRAY_FIELDS = new Set<string>([
  "propertyTypes",
  "epcLabels",
  "features",
  "keywords",
  "excludedKeywords",
]);

function normalizeConstraints(input: unknown): Record<string, unknown> {
  const src = isRecord(input) ? input : {};
  const out: Record<string, unknown> = {};

  for (const field of CONSTRAINT_FIELDS) {
    const value = src[field];
    if (value === undefined || value === null) continue;

    let normalized: unknown;
    if (AMOUNT_FIELDS.has(field)) normalized = parseAmount(value);
    else if (INT_FIELDS.has(field)) normalized = toInt(value);
    else if (field === "propertyTypes") normalized = toEnumArray(value, PROPERTY_TYPES);
    else if (field === "epcLabels") normalized = toEnumArray(value, EPC_LABELS);
    else if (field === "features") normalized = toEnumArray(value, FEATURES);
    else normalized = toTextArray(value);

    if (normalized !== undefined) out[field] = normalized;
  }

  // Onbekende velden blijven staan. Ze worden NIET stil weggegooid: een veld dat
  // het model verzint is een structuurfout, en die hoort de validatie te halen
  // zodat de retry het model er concreet op wijst. Vergelijk dat met een
  // onbekende *waarde* in een bekende lijst (feature "sauna"): daar reikt het
  // model naar een begrip dat wij niet modelleren, en dan is de waarde
  // weglaten en de rest behouden het juiste antwoord.
  for (const key of Object.keys(src)) {
    if (!(CONSTRAINT_FIELDS as readonly string[]).includes(key)) out[key] = src[key];
  }

  return out;
}

/**
 * Verwijdert uit `preferences` wat al een harde eis is.
 *
 * Per veldsoort anders, en dat verschil is wezenlijk:
 *  - Een scalair veld (maxPrice) kan maar één betekenis hebben; de harde eis
 *    wint en de voorkeur verdwijnt.
 *  - Een array (features) beschrijft een verzameling: "tuin moet, garage is een
 *    plus" is volledig legitiem. Alleen de overlappende leden verdwijnen, niet
 *    het hele veld.
 */
function subtractHardFromPreferences(
  hard: Record<string, unknown>,
  preferences: Record<string, unknown>,
): void {
  for (const field of Object.keys(hard)) {
    if (!(field in preferences)) continue;

    if (!ARRAY_FIELDS.has(field)) {
      delete preferences[field];
      continue;
    }

    const hardValues = Array.isArray(hard[field]) ? (hard[field] as unknown[]) : [];
    const prefValues = Array.isArray(preferences[field]) ? (preferences[field] as unknown[]) : [];
    const remaining = prefValues.filter((v) => !hardValues.includes(v));

    if (remaining.length > 0) preferences[field] = remaining;
    else delete preferences[field];
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Schoont ruwe modeloutput op tot iets dat `searchCriteriaSchema` kan parsen.
 * Geeft altijd een object terug; de validatie erna bepaalt of het bruikbaar is.
 */
export function normalizeRawCriteria(raw: unknown): Record<string, unknown> {
  const src = isRecord(raw) ? raw : {};
  const out: Record<string, unknown> = {};

  const tx = typeof src.transactionType === "string" ? src.transactionType.trim().toLowerCase() : undefined;
  out.transactionType = TRANSACTION_TYPES.includes(tx as never) ? tx : "buy";

  const locations = toTextArray(src.locations);
  if (locations) out.locations = locations;

  const postalCodes = toPostalCodes(src.postalCodes);
  if (postalCodes) out.postalCodes = postalCodes;

  const radius = toInt(src.radiusKm);
  // Een straal zonder plaats is betekenisloos; laat hem dan weg in plaats van
  // de hele zoekopdracht te laten falen op een refinement.
  if (radius !== undefined && radius > 0 && (locations || postalCodes)) {
    out.radiusKm = radius;
  }

  const hard = normalizeConstraints(src.hardRequirements);
  const preferences = normalizeConstraints(src.preferences);

  // Staat iets zowel bij de eisen als bij de wensen, dan wint de eis. Dat is de
  // strengere lezing: te weinig resultaten merkt een gebruiker meteen, terwijl
  // panden die niet aan zijn eis voldoen ongemerkt binnendruppelen.
  subtractHardFromPreferences(hard, preferences);

  out.hardRequirements = hard;
  out.preferences = preferences;

  // Ook op het hoogste niveau blijven onbekende velden staan, zodat `.strict()`
  // ze afwijst in plaats van dat ze geruisloos verdwijnen.
  const known = new Set(["transactionType", "locations", "postalCodes", "radiusKm", "hardRequirements", "preferences"]);
  for (const key of Object.keys(src)) {
    if (!known.has(key)) out[key] = src[key];
  }

  return out;
}
