/**
 * De regelmotor die particulier van professioneel scheidt.
 *
 * ─── WAAROM REGELS EN GEEN MODEL ─────────────────────────────────────────────
 *
 * Dit is de duurste beslissing in het systeem. Een verkeerd doorgestuurde
 * professional kost de makelaar zijn vertrouwen in de dienst; een gemiste
 * particulier kost hem een opdracht. Regels zijn hier beter dan een model
 * omdat ze (a) uitlegbaar zijn — het dashboard toont letterlijk waarom — en
 * (b) aanpasbaar zonder hertrainen zodra een nieuwe keten opduikt.
 *
 * De motor is bewust *puur*: hij krijgt een genormaliseerde advertentie plus
 * wat de database over de verkoper weet, en geeft een oordeel terug. Geen
 * query's, geen klok. `classifySeller` is daarmee volledig te testen op tafel.
 *
 * ─── HOE HET BEWIJS WORDT OPGETELD ───────────────────────────────────────────
 *
 * Elk signaal levert bewijs in het voordeel van één kant. We tellen niet op tot
 * boven 1 met een som (dan zou drie zwakke signalen sterker wegen dan één
 * sluitend bewijs), maar combineren met "noisy-or":
 *
 *     gecombineerd = 1 - Π(1 - gewicht_i)
 *
 * Dat gedraagt zich zoals je wil: twee onafhankelijke aanwijzingen van 0,5
 * geven samen 0,75, en niets komt ooit boven 1. Daarna trekken we de twee
 * kanten van elkaar af; het verschil bepaalt de uitspraak, de zwakkere kant
 * knaagt aan het vertrouwen. Een advertentie die tegelijk "zonder makelaar" en
 * een BIV-nummer bevat komt zo terecht op `unknown` in plaats van vol
 * overtuiging de verkeerde kant op te vallen.
 */
import { normalizeText } from '@/lib/text'

import type { NormalizedListing, SellerClassification, SellerHistory } from '../types'

import {
  PRIVATE_TEXT_SIGNALS,
  PROFESSIONAL_NAME_SIGNALS,
  PROFESSIONAL_TEXT_SIGNALS,
  looksLikePersonalName,
  stripNegatedAgencyMentions,
  type Signal,
} from './signals'

export interface ClassifierOptions {
  /**
   * Vanaf hoeveel gelijktijdige advertenties een verkoper als professioneel
   * geldt. Vier is de standaard: drie panden tegelijk is voor een particulier
   * ongewoon maar mogelijk (erfenis, vastgoedje), vier vrijwel niet.
   */
  professionalListingCountThreshold: number
}

export const DEFAULT_CLASSIFIER_OPTIONS: ClassifierOptions = {
  professionalListingCountThreshold: 4,
}

interface Evidence {
  weight: number
  reason: string
}

/** noisy-or: onafhankelijke aanwijzingen versterken elkaar zonder ooit 1 te halen. */
function combine(evidence: readonly Evidence[]): number {
  let complement = 1
  for (const item of evidence) {
    complement *= 1 - Math.min(0.99, Math.max(0, item.weight))
  }
  return 1 - complement
}

function matchSignals(haystack: string, signals: readonly Signal[]): Evidence[] {
  const found: Evidence[] = []
  for (const signal of signals) {
    if (signal.pattern.test(haystack)) {
      found.push({ weight: signal.weight, reason: signal.reason })
    }
  }
  return found
}

/** De velden waar de classificatie naar kijkt. Losgekoppeld van NormalizedListing
 *  zodat de motor ook op een database-rij of een testobject kan draaien. */
export interface ClassificationSubject {
  title: string | null
  description: string | null
  sellerName: string | null
  sellerPhoneE164: string | null
  sellerPhoneIsMobile: boolean
  sellerTypeHint: 'private' | 'professional' | 'unknown'
  sellerProfileUrl: string | null
  sellerListingCount: number | null
}

export function subjectFromListing(listing: NormalizedListing): ClassificationSubject {
  return {
    title: listing.title,
    description: listing.description,
    sellerName: listing.sellerName,
    sellerPhoneE164: listing.sellerPhoneE164,
    sellerPhoneIsMobile: listing.sellerPhoneIsMobile,
    sellerTypeHint: listing.sellerTypeHint,
    sellerProfileUrl: listing.sellerProfileUrl,
    sellerListingCount: listing.sellerListingCount,
  }
}

export function classifySeller(
  subject: ClassificationSubject,
  history: SellerHistory = { knownActiveListings: 0 },
  options: ClassifierOptions = DEFAULT_CLASSIFIER_OPTIONS,
): SellerClassification {
  const text = normalizeText(`${subject.title ?? ''} ${subject.description ?? ''}`)
  const name = subject.sellerName ?? ''
  const normalizedName = normalizeText(name)

  const professional: Evidence[] = []
  const priv: Evidence[] = []

  // ── 1. Tekstsignalen ──────────────────────────────────────────────────────
  // De professionele patronen draaien op een tekst waaruit ontkende
  // makelaarsvermeldingen zijn geknipt; de particuliere op de volledige tekst.
  // Zonder dat onderscheid zou "zonder makelaar" beide kanten tegelijk
  // bewijzen — zie `stripNegatedAgencyMentions`.
  professional.push(...matchSignals(stripNegatedAgencyMentions(text), PROFESSIONAL_TEXT_SIGNALS))
  priv.push(...matchSignals(text, PRIVATE_TEXT_SIGNALS))

  // ── 2. De verkopersnaam ───────────────────────────────────────────────────
  const nameSignals = normalizedName.length > 0 ? matchSignals(normalizedName, PROFESSIONAL_NAME_SIGNALS) : []
  professional.push(...nameSignals)

  if (nameSignals.length === 0 && name.length > 0) {
    if (looksLikePersonalName(name)) {
      priv.push({ weight: 0.55, reason: 'Verkopersnaam ziet eruit als een persoonsnaam' })
    }
  }

  // ── 3. Hoeveel panden heeft deze verkoper? ────────────────────────────────
  //
  // Het sterkste signaal dat we hebben zonder externe registers te bevragen.
  //
  // Let op het onderscheid tussen "nul advertenties bekend" en "geen telling
  // beschikbaar". Die twee door elkaar halen is een echte fout: een advertentie
  // van een bron die niets over de verkoper zegt zou dan als "verkoper heeft
  // één advertentie" gelden en dus als particulier bewijs meetellen — terwijl
  // we in werkelijkheid niets weten. Vandaar `null` in plaats van `0`.
  const listingCount = resolveListingCount(subject.sellerListingCount, history.knownActiveListings)

  if (listingCount !== null) {
    if (listingCount >= options.professionalListingCountThreshold) {
      professional.push({
        // Zwaar genoeg om een persoonlijk ogende naam te overstemmen: iemand
        // met vier gelijktijdige panden is in de praktijk geen particulier,
        // hoe gewoon zijn naam ook klinkt.
        weight: Math.min(
          0.95,
          0.75 + 0.05 * (listingCount - options.professionalListingCountThreshold),
        ),
        reason: `Verkoper heeft ${listingCount} gelijktijdige advertenties`,
      })
    } else if (listingCount <= 1) {
      priv.push({ weight: 0.35, reason: 'Verkoper heeft één advertentie' })
    } else if (listingCount === 2) {
      priv.push({ weight: 0.15, reason: 'Verkoper heeft twee advertenties' })
    }
  }

  // ── 4. Een verkoperspagina ────────────────────────────────────────────────
  if (subject.sellerProfileUrl) {
    const profilePath = normalizeText(subject.sellerProfileUrl)
    if (/\b(agency|agence|kantoor|immo|makelaar|pro|partner|business)\b/.test(profilePath)) {
      professional.push({ weight: 0.75, reason: 'Verkoperspagina is een professioneel profiel' })
    }
  }

  // ── 5. Wat de bron zelf zegt ──────────────────────────────────────────────
  // Een bron die zijn adverteerders in "particulier" en "professioneel"
  // indeelt weet dat beter dan wij. Maar niet blind volgen: sommige bronnen
  // laten de adverteerder het zelf aanvinken.
  if (subject.sellerTypeHint === 'professional') {
    professional.push({ weight: 0.85, reason: 'Bron markeert de adverteerder als professioneel' })
  } else if (subject.sellerTypeHint === 'private') {
    priv.push({ weight: 0.8, reason: 'Bron markeert de adverteerder als particulier' })
  }

  // ── 6. Het telefoonnummer ─────────────────────────────────────────────────
  // Zwak signaal, bewust laag gewogen: kantoren gebruiken ook gsm-nummers.
  if (subject.sellerPhoneE164 && subject.sellerPhoneIsMobile) {
    priv.push({ weight: 0.2, reason: 'Contactnummer is een mobiel nummer' })
  }

  // ── 7. Eerdere uitspraak ──────────────────────────────────────────────────
  // Voorkomt dat een verkoper heen en weer flipt op één zwak nieuw signaal.
  if (history.previousClassification === 'professional') {
    professional.push({ weight: 0.5, reason: 'Verkoper is eerder als professioneel beoordeeld' })
  } else if (history.previousClassification === 'private') {
    priv.push({ weight: 0.4, reason: 'Verkoper is eerder als particulier beoordeeld' })
  }

  // ── Optellen ──────────────────────────────────────────────────────────────
  const professionalScore = combine(professional)
  const privateScore = combine(priv)
  // Afronden vóór het vergelijken. Zonder dat valt een marge die precies op de
  // drempel hoort te liggen (0,55 − 0,70) er door drijvendekommaruis net onder,
  // en kantelt de uitspraak op een verschil van 10⁻¹⁶.
  const margin = Math.round((privateScore - professionalScore) * 1e6) / 1e6

  // Onder deze marge durven we niets te zeggen. 0,15 is zo gekozen dat één
  // enkel middelsterk signaal (0,5–0,6) zonder tegenspraak wél een uitspraak
  // oplevert, maar twee signalen die elkaar tegenspreken niet.
  const DECISION_MARGIN = 0.15

  const reasons = [...professional, ...priv]
    .sort((a, b) => b.weight - a.weight)
    .map((item) => item.reason)

  if (reasons.length === 0) {
    return { type: 'unknown', confidence: 0, reasons: ['Geen bruikbare signalen in de advertentie'] }
  }

  if (margin >= DECISION_MARGIN) {
    return {
      type: 'private',
      // Het vertrouwen is de particuliere score, afgeknepen door de
      // tegenspraak. Een advertentie met sterk bewijs aan beide kanten haalt
      // de verzenddrempel van 0,85 zo niet.
      confidence: round(privateScore * (1 - professionalScore)),
      reasons,
    }
  }

  if (margin <= -DECISION_MARGIN) {
    return {
      type: 'professional',
      confidence: round(professionalScore * (1 - privateScore)),
      reasons,
    }
  }

  return {
    type: 'unknown',
    confidence: round(Math.max(privateScore, professionalScore) * 0.5),
    reasons: [
      ...reasons,
      'Signalen spreken elkaar tegen — geen uitspraak zonder menselijke controle',
    ],
  }
}

function round(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000
}

/**
 * Combineert wat de bron zegt met wat wij zelf gezien hebben.
 *
 * Geeft `null` wanneer geen van beide een telling levert — "onbekend" is geen
 * bewijs, in geen van beide richtingen.
 */
function resolveListingCount(
  fromSource: number | null,
  fromHistory: number,
): number | null {
  const known: number[] = []
  if (fromSource !== null && fromSource > 0) known.push(fromSource)
  if (fromHistory > 0) known.push(fromHistory)

  return known.length === 0 ? null : Math.max(...known)
}

/**
 * Mag deze lead automatisch verstuurd worden?
 *
 * Bewust een aparte functie en geen `>=` op de call-site: de drempel is de
 * belangrijkste veiligheidsklep van de dienst, en die hoort op één plek te
 * staan waar hij ook getest wordt.
 */
export function qualifiesForAutomaticAlert(
  classification: SellerClassification,
  threshold: number,
): boolean {
  return classification.type === 'private' && classification.confidence >= threshold
}
