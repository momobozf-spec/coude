/**
 * Matching: past een woning bij de criteria van een gebruiker?
 *
 * Twee uitkomsten, en het verschil is essentieel:
 *
 *   hardPass — alle harde eisen gehaald. Bij false wordt er niet gemeld.
 *   score    — 0-100, het aandeel gehaalde voorkeuren.
 *
 * ─── DE BELANGRIJKSTE REGEL: ONBEKEND ≠ NIET GEHAALD ─────────────────────────
 *
 * Vastgoedadvertenties zijn onvolledig. Als het EPC-label ontbreekt, is dat geen
 * bewijs dat het slecht is. Een woning straffen voor wat de makelaar niet heeft
 * ingevuld, betekent dat de beste woningen met de slechtste advertentie
 * onderaan belanden.
 *
 * Daarom:
 *   - onbekend telt NIET mee in de noemer van de score;
 *   - onbekend faalt NIET op een harde eis, maar wordt gerapporteerd als
 *     `unknown` zodat de UI "controleer dit zelf" kan tonen.
 *
 * Die tweede keuze is een afweging. Streng zijn (onbekend = fail) zou woningen
 * wegfilteren die perfect passen. Wij tonen ze mét een waarschuwing, want de
 * gebruiker kan één telefoontje plegen; een weggefilterde woning ziet hij nooit.
 */
import {
  EPC_LABELS,
  type Constraints,
  type EpcLabel,
  type SearchCriteria,
} from '@/modules/search/schemas/searchCriteria'

export type Verdict = 'pass' | 'fail' | 'unknown'

export interface MatchReason {
  field: string
  verdict: Verdict
  /** Leesbare toelichting; wat de melding en de AI-samenvatting tonen. */
  detail: string
  /** Was dit een harde eis of een voorkeur? */
  scope: 'hard' | 'preference'
}

export interface MatchResult {
  hardPass: boolean
  score: number
  reasons: MatchReason[]
}

/** De velden die de matcher van een woning nodig heeft. */
export interface MatchableProperty {
  title: string
  description: string | null
  city: string | null
  postalCode: string | null
  propertyType: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaM2: number | null
  landAreaM2: number | null
  epcLabel: string | null
  features: readonly string[]
  /** Afstand in meters per voorziening, als de buurtmodule ze geleverd heeft. */
  nearbyDistances?: Partial<Record<string, number>>
}

function epcRank(label: string | null): number | null {
  if (!label) return null
  const index = (EPC_LABELS as readonly string[]).indexOf(label.toUpperCase())
  return index === -1 ? null : index
}

/** Haalt het label de lat van het slechtste aanvaarde label? */
function epcMeets(actual: string | null, accepted: readonly EpcLabel[]): Verdict {
  const rank = epcRank(actual)
  if (rank === null) return 'unknown'
  // Lager is beter: A++ is index 0. De slechtste die nog mag, is de hoogste index.
  const worstAccepted = Math.max(...accepted.map((l) => epcRank(l) ?? 0))
  return rank <= worstAccepted ? 'pass' : 'fail'
}

function haystack(property: MatchableProperty): string {
  return `${property.title} ${property.description ?? ''}`.toLowerCase()
}

/**
 * Toetst één set constraints. Geeft per criterium een oordeel terug.
 * Wordt twee keer aangeroepen: voor de harde eisen en voor de voorkeuren.
 */
function evaluateConstraints(
  property: MatchableProperty,
  constraints: Constraints,
  scope: 'hard' | 'preference',
): MatchReason[] {
  const reasons: MatchReason[] = []
  const add = (field: string, verdict: Verdict, detail: string) =>
    reasons.push({ field, verdict, detail, scope })

  const numeric = (
    field: string,
    limit: number | undefined,
    actual: number | null,
    compare: (actual: number, limit: number) => boolean,
    describe: (limit: number, actual: number | null) => string,
  ) => {
    if (limit === undefined) return
    if (actual === null) return add(field, 'unknown', describe(limit, null))
    add(field, compare(actual, limit) ? 'pass' : 'fail', describe(limit, actual))
  }

  numeric(
    'maxPrice',
    constraints.maxPrice,
    property.price,
    (a, l) => a <= l,
    (l, a) =>
      a === null
        ? `Prijs onbekend (gevraagd: hoogstens ${l.toLocaleString('nl-BE')} €)`
        : a <= l
          ? `${(l - a).toLocaleString('nl-BE')} € onder je maximum`
          : `${(a - l).toLocaleString('nl-BE')} € boven je maximum`,
  )

  numeric(
    'minPrice',
    constraints.minPrice,
    property.price,
    (a, l) => a >= l,
    (l, a) =>
      a === null
        ? `Prijs onbekend (gevraagd: minstens ${l.toLocaleString('nl-BE')} €)`
        : `Prijs ${a.toLocaleString('nl-BE')} €, ondergrens ${l.toLocaleString('nl-BE')} €`,
  )

  numeric(
    'minBedrooms',
    constraints.minBedrooms,
    property.bedrooms,
    (a, l) => a >= l,
    (l, a) =>
      a === null
        ? `Aantal slaapkamers niet vermeld (gevraagd: minstens ${l})`
        : `${a} slaapkamer${a === 1 ? '' : 's'} (gevraagd: minstens ${l})`,
  )

  numeric(
    'minBathrooms',
    constraints.minBathrooms,
    property.bathrooms,
    (a, l) => a >= l,
    (l, a) =>
      a === null
        ? `Aantal badkamers niet vermeld (gevraagd: minstens ${l})`
        : `${a} badkamer${a === 1 ? '' : 's'} (gevraagd: minstens ${l})`,
  )

  numeric(
    'minSurfaceM2',
    constraints.minSurfaceM2,
    property.livingAreaM2,
    (a, l) => a >= l,
    (l, a) =>
      a === null
        ? `Bewoonbare oppervlakte niet vermeld (gevraagd: minstens ${l} m²)`
        : `${a} m² bewoonbaar (gevraagd: minstens ${l} m²)`,
  )

  numeric(
    'minLandSurfaceM2',
    constraints.minLandSurfaceM2,
    property.landAreaM2,
    (a, l) => a >= l,
    (l, a) =>
      a === null
        ? `Perceeloppervlakte niet vermeld (gevraagd: minstens ${l} m²)`
        : `${a} m² perceel (gevraagd: minstens ${l} m²)`,
  )

  if (constraints.propertyTypes?.length) {
    const actual = property.propertyType?.toLowerCase() ?? null
    if (actual === null) {
      add('propertyTypes', 'unknown', 'Woningtype niet vermeld')
    } else {
      const ok = constraints.propertyTypes.includes(actual as never)
      add(
        'propertyTypes',
        ok ? 'pass' : 'fail',
        ok ? `Type ${actual}` : `Type ${actual}, je zocht ${constraints.propertyTypes.join(' of ')}`,
      )
    }
  }

  if (constraints.epcLabels?.length) {
    const verdict = epcMeets(property.epcLabel, constraints.epcLabels)
    add(
      'epcLabels',
      verdict,
      verdict === 'unknown'
        ? 'Geen EPC-label vermeld — vraag dit op bij de makelaar'
        : `EPC ${property.epcLabel} (gevraagd: ${constraints.epcLabels.join(', ')})`,
    )
  }

  if (constraints.features?.length) {
    const owned = new Set(property.features.map((f) => f.toLowerCase()))
    const text = haystack(property)
    for (const feature of constraints.features) {
      // Twee bronnen: de genormaliseerde featurelijst van de bron, en de tekst.
      // "tuin" staat vaak alleen in de omschrijving.
      const present = owned.has(feature) || text.includes(feature.replace('_', ' '))
      add('features', present ? 'pass' : 'unknown', present ? `Heeft ${feature}` : `${feature} niet vermeld`)
    }
  }

  if (constraints.nearby?.length) {
    for (const requirement of constraints.nearby) {
      const distance = property.nearbyDistances?.[requirement.category]
      if (distance === undefined) {
        add('nearby', 'unknown', `Afstand tot ${requirement.category} nog niet bepaald`)
        continue
      }
      const ok = distance <= requirement.maxDistanceMeters
      add(
        'nearby',
        ok ? 'pass' : 'fail',
        `${(distance / 1000).toFixed(1).replace('.', ',')} km tot ${requirement.category} ` +
          `(gevraagd: binnen ${(requirement.maxDistanceMeters / 1000).toFixed(1).replace('.', ',')} km)`,
      )
    }
  }

  if (constraints.keywords?.length) {
    const text = haystack(property)
    for (const keyword of constraints.keywords) {
      const present = text.includes(keyword.toLowerCase())
      // Een ontbrekend trefwoord is 'unknown', niet 'fail': de advertentietekst
      // is geen volledige beschrijving van de woning.
      add('keywords', present ? 'pass' : 'unknown', `"${keyword}" ${present ? 'gevonden' : 'niet gevonden'} in de tekst`)
    }
  }

  if (constraints.excludedKeywords?.length) {
    const text = haystack(property)
    for (const keyword of constraints.excludedKeywords) {
      const present = text.includes(keyword.toLowerCase())
      // Hier is aanwezigheid wél hard: als er "te renoveren" staat, staat het er.
      add(
        'excludedKeywords',
        present ? 'fail' : 'pass',
        present ? `Bevat "${keyword}", dat wilde je vermijden` : `Geen "${keyword}"`,
      )
    }
  }

  return reasons
}

/** Scope-eisen: koop/huur en locatie. Altijd hard. */
function evaluateScope(property: MatchableProperty, criteria: SearchCriteria): MatchReason[] {
  const reasons: MatchReason[] = []

  if (criteria.postalCodes?.length) {
    const actual = property.postalCode
    if (!actual) {
      reasons.push({
        field: 'postalCodes',
        verdict: 'unknown',
        detail: 'Postcode niet vermeld',
        scope: 'hard',
      })
    } else {
      const ok = criteria.postalCodes.includes(actual)
      reasons.push({
        field: 'postalCodes',
        verdict: ok ? 'pass' : 'fail',
        detail: ok ? `Postcode ${actual}` : `Postcode ${actual} valt buiten je zoekgebied`,
        scope: 'hard',
      })
    }
  } else if (criteria.locations?.length) {
    const city = property.city?.toLowerCase() ?? null
    if (!city) {
      reasons.push({
        field: 'locations',
        verdict: 'unknown',
        detail: 'Gemeente niet vermeld',
        scope: 'hard',
      })
    } else {
      const ok = criteria.locations.some((l) => city.includes(l.toLowerCase()))
      reasons.push({
        field: 'locations',
        verdict: ok ? 'pass' : 'fail',
        detail: ok ? `In ${property.city}` : `${property.city} staat niet in je zoekgebied`,
        scope: 'hard',
      })
    }
  }

  return reasons
}

export function matchProperty(
  property: MatchableProperty,
  criteria: SearchCriteria,
): MatchResult {
  const reasons: MatchReason[] = [
    ...evaluateScope(property, criteria),
    ...evaluateConstraints(property, criteria.hardRequirements, 'hard'),
    ...evaluateConstraints(property, criteria.preferences, 'preference'),
  ]

  // Alleen een expliciete 'fail' op een harde eis blokkeert. 'unknown' niet —
  // zie de kop van dit bestand.
  const hardPass = !reasons.some((r) => r.scope === 'hard' && r.verdict === 'fail')

  // De noemer is het aantal criteria waarover we een uitspraak kúnnen doen.
  // Zonder beoordeelbare criteria is er niets om een percentage van te nemen;
  // dan is 100 het eerlijke antwoord (er is niets waar de woning op faalt).
  const decided = reasons.filter((r) => r.verdict !== 'unknown')
  const passed = decided.filter((r) => r.verdict === 'pass').length
  const score = decided.length === 0 ? 100 : Math.round((passed / decided.length) * 100)

  return { hardPass, score, reasons }
}

/** De feiten die de AI mag gebruiken voor een samenvatting. Niets anders. */
export function matchFacts(result: MatchResult): {
  positives: string[]
  concerns: string[]
  unknowns: string[]
} {
  return {
    positives: result.reasons.filter((r) => r.verdict === 'pass').map((r) => r.detail),
    concerns: result.reasons.filter((r) => r.verdict === 'fail').map((r) => r.detail),
    unknowns: result.reasons.filter((r) => r.verdict === 'unknown').map((r) => r.detail),
  }
}
