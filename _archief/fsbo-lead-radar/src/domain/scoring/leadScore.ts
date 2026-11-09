/**
 * Leadscore 0–100.
 *
 * ─── WAT DE SCORE BETEKENT ───────────────────────────────────────────────────
 *
 * Niet "hoe mooi is deze woning", maar "hoe waarschijnlijk is het dat deze
 * makelaar hier vandaag een opdracht uit haalt". Die twee lopen uiteen: een
 * villa van €1,2 miljoen die al drie dagen online staat is een slechtere lead
 * dan een rijwoning van €240.000 die vier minuten geleden verscheen, want op
 * de eerste heeft de eigenaar al tien telefoontjes gehad.
 *
 * Vandaar dat versheid en bereikbaarheid samen meer wegen dan de woning zelf.
 *
 * ─── WAAROM DE PUNTEN OPTELLEN EN NIET VERMENIGVULDIGEN ──────────────────────
 *
 * De score wordt gelezen door mensen die hem moeten vertrouwen. Een optelling
 * met benoemde componenten is uit te leggen ("40 voor particulier, 20 voor het
 * nummer, 20 omdat hij vers is") en in het dashboard te tonen. Dat is meer
 * waard dan de extra nuance van een kansmodel dat niemand kan navertellen.
 *
 * ─── DE VERDELING ────────────────────────────────────────────────────────────
 *
 *   particuliere verkoper   0–40   schaalt met de zekerheid
 *   telefoonnummer          0/20
 *   versheid                0–20
 *   gebiedsmatch            0–10   exact > gemeente > straal > provincie
 *   volledigheid            0–10
 *                          ─────
 *                            100   ← precies bereikbaar, nooit overschreden
 *
 *   prijsrange            −12–0    aftrek
 *   duplicaat               −30    aftrek
 *   herplaatsing            −12    aftrek
 *
 * Dat de opbouw exact op 100 uitkomt is geen cosmetiek: zou hij erboven
 * uitkomen, dan zou de afkapping op 100 de verschillen wegsnijden tussen leads
 * die juist onderscheiden moeten worden.
 */
import type { LeadScore, ScoreComponent, SellerClassification } from '../types'

export interface ScoringInput {
  classification: SellerClassification
  hasPhone: boolean
  /** Minuten sinds de advertentie voor het eerst gezien of gepubliceerd werd. */
  ageMinutes: number
  /** Sterkte van de gebiedsmatch; null wanneer er geen gebied aan hangt. */
  territoryPrecision: 'exact' | 'municipality' | 'province' | 'radius' | null
  price: number | null
  listingType: 'sale' | 'rent' | null
  bedrooms: number | null
  surfaceArea: number | null
  propertyType: string | null
  postalCode: string | null
  /** Is dit een duplicaat of een herplaatsing van iets dat we al kenden? */
  isDuplicate: boolean
  isRelist: boolean
}

/**
 * Prijsvensters waarin een particuliere verkoop het meest oplevert voor een
 * makelaar: courant genoeg om snel te verkopen, duur genoeg om de moeite waard
 * te zijn.
 */
const SALE_SWEET_SPOT = { low: 180_000, high: 650_000 }
const RENT_SWEET_SPOT = { low: 650, high: 2_500 }

/**
 * De prijs kan alleen punten *kosten*, nooit opleveren.
 *
 * ─── WAAROM AFTREK EN GEEN OPTELLING ─────────────────────────────────────────
 *
 * De vijf hoofdcomponenten tellen samen op tot precies 100. Zou de prijs daar
 * nog punten bovenop leggen, dan zit een goede lead tegen het plafond en snijdt
 * de afronding op 100 juist de verschillen weg die de rangschikking bruikbaar
 * maken: een lead met een exacte gebiedsmatch en een lead met een provinciale
 * zouden allebei op 100 uitkomen.
 *
 * Als aftrek doet de prijs wél zijn werk — een woning van €40.000 of van €3
 * miljoen zakt in de lijst — zonder de rest van de schaal plat te drukken.
 */
function priceComponent(price: number | null, listingType: 'sale' | 'rent' | null): ScoreComponent {
  if (price === null || price === 0) {
    return { label: 'Prijs onbekend', points: -4 }
  }

  const window = listingType === 'rent' ? RENT_SWEET_SPOT : SALE_SWEET_SPOT

  if (price >= window.low && price <= window.high) {
    return { label: 'Prijs in courante range', points: 0 }
  }
  // Net buiten het venster (factor 2) is nog interessant; ver erbuiten niet.
  if (price >= window.low / 2 && price <= window.high * 2) {
    return { label: 'Prijs net buiten de courante range', points: -5 }
  }
  return { label: 'Prijs buiten de courante range', points: -12 }
}

/**
 * Versheid. Dit is de component die de dienst zijn bestaansrecht geeft: onder
 * de tien minuten is de makelaar vrijwel zeker de eerste die belt.
 */
function freshnessComponent(ageMinutes: number): ScoreComponent {
  if (ageMinutes < 0) return { label: 'Publicatiedatum in de toekomst', points: 10 }
  if (ageMinutes <= 10) return { label: 'Gevonden binnen 10 minuten', points: 20 }
  if (ageMinutes <= 30) return { label: 'Gevonden binnen 30 minuten', points: 16 }
  if (ageMinutes <= 120) return { label: 'Gevonden binnen 2 uur', points: 12 }
  if (ageMinutes <= 60 * 24) return { label: 'Vandaag gevonden', points: 7 }
  if (ageMinutes <= 60 * 24 * 3) return { label: 'Minder dan 3 dagen oud', points: 3 }
  return { label: 'Ouder dan 3 dagen', points: 0 }
}

function completenessComponent(input: ScoringInput): ScoreComponent {
  // Elk veld dat ontbreekt is een telefoontje dat de makelaar moet plegen
  // voordat hij weet of de lead de moeite waard is.
  const fields = [
    input.price !== null,
    input.bedrooms !== null,
    input.surfaceArea !== null,
    input.propertyType !== null,
    input.postalCode !== null,
  ]
  const filled = fields.filter(Boolean).length
  const points = Math.round((filled / fields.length) * 10)

  return { label: `Woninggegevens ${filled}/${fields.length} compleet`, points }
}

function territoryComponent(
  precision: ScoringInput['territoryPrecision'],
): ScoreComponent {
  switch (precision) {
    case 'exact':
      return { label: 'Exacte postcodematch met werkgebied', points: 10 }
    case 'municipality':
      return { label: 'Gemeentematch met werkgebied', points: 8 }
    case 'radius':
      return { label: 'Binnen straal van werkgebied', points: 6 }
    case 'province':
      return { label: 'Provinciematch met werkgebied', points: 3 }
    case null:
      return { label: 'Geen gebiedsmatch', points: 0 }
  }
}

export function calculateLeadScore(input: ScoringInput): LeadScore {
  const components: ScoreComponent[] = []

  // ── Particulier: de zwaarste component, tot 40 punten ─────────────────────
  // Lineair in het vertrouwen, niet binair. Een lead met 0,86 zekerheid is
  // echt zwakker dan een met 0,99, en de makelaar mag dat zien.
  if (input.classification.type === 'private') {
    components.push({
      label: `Particuliere verkoper (${Math.round(input.classification.confidence * 100)}% zeker)`,
      points: Math.round(40 * input.classification.confidence),
    })
  } else if (input.classification.type === 'unknown') {
    // Onbekend is niet nul: het kán een particulier zijn, en de lead verschijnt
    // in het dashboard ook al gaat er geen alert uit.
    components.push({
      label: 'Verkoperstype onbekend',
      points: Math.round(12 * (1 - input.classification.confidence)),
    })
  } else {
    components.push({ label: 'Professionele verkoper', points: 0 })
  }

  // ── Bereikbaarheid: 20 punten ─────────────────────────────────────────────
  // Zonder telefoonnummer moet de makelaar via het contactformulier van de
  // bron, en dan is hij niet meer de eerste.
  components.push(
    input.hasPhone
      ? { label: 'Telefoonnummer beschikbaar', points: 20 }
      : { label: 'Geen telefoonnummer', points: 0 },
  )

  components.push(freshnessComponent(input.ageMinutes))
  components.push(territoryComponent(input.territoryPrecision))
  components.push(completenessComponent(input))
  components.push(priceComponent(input.price, input.listingType))

  // ── Aftrek ────────────────────────────────────────────────────────────────
  if (input.isDuplicate) {
    // Een duplicaat gaat normaal niet als alert de deur uit; scoort hij toch,
    // dan hoort hij onderaan de lijst.
    components.push({ label: 'Duplicaat van een bekende advertentie', points: -30 })
  } else if (input.isRelist) {
    components.push({ label: 'Herplaatsing van een eerdere advertentie', points: -12 })
  }

  const total = components.reduce((sum, component) => sum + component.points, 0)

  return {
    total: Math.max(0, Math.min(100, total)),
    components,
  }
}

/** Minuten tussen twee momenten, nooit negatief afgerond op hele minuten. */
export function ageInMinutes(reference: Date, moment: Date | null): number {
  if (moment === null) return 0
  return Math.max(0, Math.round((reference.getTime() - moment.getTime()) / 60_000))
}
