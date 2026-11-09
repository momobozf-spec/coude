/**
 * De bron van waarheid voor zoekcriteria.
 *
 * Alles hangt hieraan: de TS-types worden afgeleid (`z.infer`), het JSON-schema
 * dat het taalmodel als outputcontract krijgt wordt hieruit gegenereerd, en de
 * API-validatie gebruikt hetzelfde object. Eén definitie kan niet uit elkaar
 * lopen met zichzelf.
 *
 * VORM: scope bovenaan, daaronder `hardRequirements` en `preferences` met
 * dezelfde velden.
 *
 *   - Scope (transactionType, locations, postalCodes, radiusKm) is altijd hard.
 *     Koop-of-huur en waar je zoekt zijn geen voorkeuren.
 *   - `hardRequirements` faalt → geen match, geen melding.
 *   - `preferences` faalt → lagere score, wél getoond.
 *
 * Dit is bewust een geneste vorm en geen platte lijst met een `hard: [...]`-
 * array. De geneste vorm mapt één-op-één op de taal van de gebruiker ("moet",
 * "minstens" → hard; "liefst", "bij voorkeur" → preference) en dwingt het model
 * niet om elk veld twee keer te noemen. Dat scheelt een hele klasse fouten.
 */
import { z } from 'zod'

/**
 * Versie van dit schema; opgeslagen in `PropertySearch.criteriaVersion`.
 * Verhoog bij elke wijziging die opgeslagen documenten ongeldig maakt, zodat
 * een migratie later niet hoeft te gokken.
 */
export const CRITERIA_SCHEMA_VERSION = 1

export const TRANSACTION_TYPES = ['buy', 'rent'] as const

export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'villa',
  'studio',
  'penthouse',
  'duplex',
  'loft',
  'bungalow',
  'farmhouse',
  'land',
  'commercial',
  'garage',
  'other',
] as const

/**
 * Belgische EPC-labels, van best naar slechtst. De volgorde ÍS de betekenis:
 * de matching engine leidt "minstens B" af uit de index in deze array.
 */
export const EPC_LABELS = ['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

export const FEATURES = [
  'garden',
  'garage',
  'parking',
  'terrace',
  'balcony',
  'elevator',
  'swimming_pool',
  'cellar',
  'attic',
  'fireplace',
  'solar_panels',
  'heat_pump',
  'air_conditioning',
  'detached',
  'semi_detached',
  'renovated',
  'new_build',
  'furnished',
  'accessible',
] as const

/**
 * Buurtvoorzieningen die als zoekcriterium mogen dienen. Dit is wat "dichtbij
 * een moskee" tot een filter maakt in plaats van een vrome wens in een
 * keywordveld.
 */
export const NEARBY_REQUIREMENTS = [
  'mosque',
  'school',
  'halal_shop',
  'supermarket',
  'public_transport',
  'hospital',
  'park',
] as const

const positiveInt = z.number().int().positive()
const nonEmptyString = z.string().trim().min(1).max(120)

/** Een voorziening met een maximale afstand. */
export const nearbyRequirementSchema = z
  .object({
    category: z.enum(NEARBY_REQUIREMENTS),
    maxDistanceMeters: z.number().int().min(100).max(20_000).default(2000),
  })
  .strict()

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

    /** Aanvaarde labels. "EPC A of B" wordt ['A++','A+','A','B'] door het model. */
    epcLabels: z.array(z.enum(EPC_LABELS)).min(1).optional(),

    features: z.array(z.enum(FEATURES)).max(20).optional(),

    nearby: z.array(nearbyRequirementSchema).max(7).optional(),

    keywords: z.array(nonEmptyString).max(20).optional(),
    excludedKeywords: z.array(nonEmptyString).max(20).optional(),
  })
  .strict()

export const searchCriteriaSchema = z
  .object({
    // ── Scope: altijd hard ───────────────────────────────────────────────────
    transactionType: z.enum(TRANSACTION_TYPES).default('buy'),
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
    for (const scope of ['hardRequirements', 'preferences'] as const) {
      const g = c[scope]
      if (g.minPrice !== undefined && g.maxPrice !== undefined && g.minPrice > g.maxPrice) {
        ctx.addIssue({
          code: 'custom',
          path: [scope, 'minPrice'],
          message: 'minPrice mag niet groter zijn dan maxPrice',
        })
      }
    }
    if (c.radiusKm !== undefined && !c.locations?.length && !c.postalCodes?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['radiusKm'],
        message: 'radiusKm heeft geen betekenis zonder locations of postalCodes',
      })
    }
  })

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>
export type Constraints = z.infer<typeof constraintsSchema>
export type NearbyRequirement = z.infer<typeof nearbyRequirementSchema>
export type TransactionTypeInput = (typeof TRANSACTION_TYPES)[number]
export type PropertyTypeInput = (typeof PROPERTY_TYPES)[number]
export type EpcLabel = (typeof EPC_LABELS)[number]
export type Feature = (typeof FEATURES)[number]
export type NearbyCategory = (typeof NEARBY_REQUIREMENTS)[number]

/** Velden binnen `hardRequirements` / `preferences`. */
export const CONSTRAINT_FIELDS = [
  'propertyTypes',
  'minPrice',
  'maxPrice',
  'minBedrooms',
  'minBathrooms',
  'minSurfaceM2',
  'minLandSurfaceM2',
  'epcLabels',
  'features',
  'nearby',
  'keywords',
  'excludedKeywords',
] as const

/** Scope-velden; altijd hard. */
export const SCOPE_FIELDS = ['transactionType', 'locations', 'postalCodes', 'radiusKm'] as const

export type ConstraintField = (typeof CONSTRAINT_FIELDS)[number]
export type ScopeField = (typeof SCOPE_FIELDS)[number]
export type CriteriaField = ConstraintField | ScopeField

/** Lege criteria — het neutrale startpunt, en wat een uitgeschakelde AI teruggeeft. */
export function emptyCriteria(): SearchCriteria {
  return searchCriteriaSchema.parse({})
}

/** Bevat deze zoekopdracht überhaupt een bruikbaar criterium? */
export function hasAnyCriterion(criteria: SearchCriteria): boolean {
  const groups = [criteria.hardRequirements, criteria.preferences]
  const hasConstraint = groups.some((g) =>
    CONSTRAINT_FIELDS.some((f) => {
      const v = g[f]
      return Array.isArray(v) ? v.length > 0 : v !== undefined
    }),
  )
  return (
    hasConstraint || Boolean(criteria.locations?.length) || Boolean(criteria.postalCodes?.length)
  )
}

/** Een leesbare samenvatting, voor de titel van een opgeslagen zoekopdracht. */
export function describeCriteria(criteria: SearchCriteria): string {
  const parts: string[] = []
  const hard = criteria.hardRequirements

  parts.push(criteria.transactionType === 'rent' ? 'Te huur' : 'Te koop')
  if (criteria.locations?.length) parts.push(`in ${criteria.locations.join(', ')}`)
  if (hard.maxPrice) parts.push(`tot ${hard.maxPrice.toLocaleString('nl-BE')} €`)
  if (hard.minBedrooms) parts.push(`vanaf ${hard.minBedrooms} slaapkamers`)

  return parts.join(' · ')
}
