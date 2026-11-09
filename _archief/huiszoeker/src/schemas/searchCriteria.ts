/**
 * De bron van waarheid voor zoekcriteria.
 *
 * Alles hangt hieraan: de TS-types worden afgeleid (`z.infer`), het JSON-schema
 * dat het LLM als outputcontract krijgt wordt hieruit gegenereerd, en de
 * API-validatie gebruikt hetzelfde object. Eén definitie kan niet uit elkaar
 * lopen met zichzelf.
 *
 * VORM: scope bovenaan, daaronder `hardRequirements` en `preferences` met
 * dezelfde velden.
 *
 *   - Scope (transactionType, locations, postalCodes, radiusKm) is altijd hard.
 *     Koop-of-huur en waar-je-zoekt zijn geen voorkeuren; wie ook in
 *     Sint-Niklaas wil kijken zet die er gewoon bij.
 *   - `hardRequirements` faalt → geen match, geen melding.
 *   - `preferences` faalt → lagere score, wél gemeld.
 *
 * Dit is bewust een geneste vorm en geen platte lijst met een `hard: [...]`-
 * array. De geneste vorm mapt één-op-één op de taal van de gebruiker ("moet",
 * "minstens" → hard; "liefst", "bij voorkeur" → preference) en dwingt het model
 * niet om elk veld twee keer te noemen. Dat scheelt een hele klasse fouten.
 */
import { z } from "zod";

/**
 * Versie van dit schema; opgeslagen in `Search.criteriaVersion`. Verhoog bij
 * elke wijziging die oude opgeslagen documenten ongeldig maakt, zodat een
 * migratie later niet hoeft te gokken.
 */
export const CRITERIA_SCHEMA_VERSION = 1;

export const TRANSACTION_TYPES = ["buy", "rent"] as const;

export const PROPERTY_TYPES = [
  "house",
  "apartment",
  "villa",
  "studio",
  "penthouse",
  "duplex",
  "loft",
  "bungalow",
  "farmhouse",
  "land",
  "commercial",
  "garage",
  "other",
] as const;

/**
 * Belgische EPC-labels, van best naar slechtst. De volgorde ís de betekenis:
 * de matching engine leidt "minstens B" af uit de index in deze array.
 */
export const EPC_LABELS = ["A++", "A+", "A", "B", "C", "D", "E", "F", "G"] as const;

export const FEATURES = [
  "garden",
  "garage",
  "parking",
  "terrace",
  "balcony",
  "elevator",
  "swimming_pool",
  "cellar",
  "attic",
  "fireplace",
  "solar_panels",
  "heat_pump",
  "air_conditioning",
  "detached",
  "semi_detached",
  "renovated",
  "new_build",
  "furnished",
  "accessible",
] as const;

const positiveInt = z.number().int().positive();
const nonEmptyString = z.string().trim().min(1).max(120);

/**
 * De velden die zowel een harde eis als een voorkeur kunnen zijn. Eén definitie,
 * twee keer gebruikt — zo kan `hardRequirements` nooit uit de pas lopen met
 * `preferences`.
 */
export const constraintsSchema = z
  .object({
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).min(1).max(10).optional(),

    minPrice: positiveInt.max(50_000_000).optional(),
    maxPrice: positiveInt.max(50_000_000).optional(),

    minBedrooms: z.number().int().min(0).max(20).optional(),
    minBathrooms: z.number().int().min(0).max(10).optional(),

    minSurfaceM2: positiveInt.max(10_000).optional(),
    minLandSurfaceM2: positiveInt.max(1_000_000).optional(),

    epcLabels: z.array(z.enum(EPC_LABELS)).min(1).optional(),

    features: z.array(z.enum(FEATURES)).max(20).optional(),

    keywords: z.array(nonEmptyString).max(20).optional(),
    excludedKeywords: z.array(nonEmptyString).max(20).optional(),
  })
  .strict();

export const searchCriteriaSchema = z
  .object({
    // ── Scope: altijd hard ───────────────────────────────────────────────────
    transactionType: z.enum(TRANSACTION_TYPES).default("buy"),
    locations: z.array(nonEmptyString).min(1).max(20).optional(),
    /** Belgische postcodes zijn vier cijfers. */
    postalCodes: z.array(z.string().regex(/^\d{4}$/)).min(1).max(50).optional(),
    radiusKm: z.number().int().min(1).max(100).optional(),

    // ── Eisen en wensen ──────────────────────────────────────────────────────
    hardRequirements: constraintsSchema.default({}),
    preferences: constraintsSchema.default({}),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const scope of ["hardRequirements", "preferences"] as const) {
      const g = c[scope];
      if (g.minPrice !== undefined && g.maxPrice !== undefined && g.minPrice > g.maxPrice) {
        ctx.addIssue({
          code: "custom",
          path: [scope, "minPrice"],
          message: "minPrice mag niet groter zijn dan maxPrice",
        });
      }
    }
    if (c.radiusKm !== undefined && !c.locations?.length && !c.postalCodes?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["radiusKm"],
        message: "radiusKm heeft geen betekenis zonder locations of postalCodes",
      });
    }
  });

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type EpcLabel = (typeof EPC_LABELS)[number];
export type Feature = (typeof FEATURES)[number];

/** Velden binnen `hardRequirements` / `preferences`. */
export const CONSTRAINT_FIELDS = [
  "propertyTypes",
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "minBathrooms",
  "minSurfaceM2",
  "minLandSurfaceM2",
  "epcLabels",
  "features",
  "keywords",
  "excludedKeywords",
] as const;

/** Scope-velden; altijd hard. */
export const SCOPE_FIELDS = ["transactionType", "locations", "postalCodes", "radiusKm"] as const;

export type ConstraintField = (typeof CONSTRAINT_FIELDS)[number];
export type ScopeField = (typeof SCOPE_FIELDS)[number];
export type CriteriaField = ConstraintField | ScopeField;

/** Lege criteria — het neutrale startpunt, en wat `AI_ENABLED=false` teruggeeft. */
export function emptyCriteria(): SearchCriteria {
  return searchCriteriaSchema.parse({});
}

/** Bevat deze zoekopdracht überhaupt een bruikbaar criterium? */
export function hasAnyCriterion(criteria: SearchCriteria): boolean {
  const groups = [criteria.hardRequirements, criteria.preferences];
  const hasConstraint = groups.some((g) =>
    CONSTRAINT_FIELDS.some((f) => {
      const v = g[f];
      return Array.isArray(v) ? v.length > 0 : v !== undefined;
    }),
  );
  return hasConstraint || Boolean(criteria.locations?.length) || Boolean(criteria.postalCodes?.length);
}
