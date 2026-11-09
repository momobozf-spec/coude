/**
 * De woordenlijsten waarop particulier/professioneel wordt onderscheiden.
 *
 * Apart van de regelmotor omdat dít het deel is dat verandert: nieuwe
 * makelaarsketens, nieuwe formuleringen. De motor zelf blijft dan met rust.
 *
 * Alle patronen draaien tegen *genormaliseerde* tekst (kleine letters, geen
 * accenten, leestekens vervangen door spaties — zie `normalizeText`). Ze mogen
 * dus geen hoofdletters of accenten bevatten, en woordgrenzen zijn spaties.
 */

export interface Signal {
  id: string
  pattern: RegExp
  weight: number
  reason: string
}

/**
 * Woorden die zeggen: hier zit een professional achter.
 *
 * Let op de rangschikking. "immo" in een verkopersnaam is bijna sluitend
 * bewijs (weight 0.9); "syndic" of "epc-attest verkrijgbaar via ons kantoor"
 * zijn zwakker (0.3–0.5) omdat een particulier die woorden ook kan gebruiken.
 * Het is de optelsom die telt, niet één treffer.
 */
export const PROFESSIONAL_TEXT_SIGNALS: readonly Signal[] = [
  {
    id: 'agency-vocabulary',
    pattern: /\b(vastgoedkantoor|immobilienkantoor|immokantoor|makelaarskantoor|agence immobiliere|immobiliere|real estate agency|estate agent)\b/,
    weight: 0.9,
    reason: 'Tekst noemt een vastgoedkantoor',
  },
  {
    id: 'agency-role',
    pattern: /\b(makelaar|vastgoedmakelaar|courtier|agent immobilier|negociateur|rentmeester)\b/,
    weight: 0.75,
    reason: 'Tekst noemt een makelaar als betrokken partij',
  },
  {
    id: 'bivstatute',
    // Het BIV-nummer is het erkenningsnummer van de Belgische vastgoedmakelaar.
    // Staat dat in een advertentie, dan is de adverteerder per definitie een pro.
    pattern: /\b(biv|ipi)[\s-]?(nummer|nr|number|no)?\s*[0-9]{3,7}\b/,
    weight: 0.98,
    reason: 'BIV/IPI-erkenningsnummer vermeld (wettelijk verplicht voor makelaars)',
  },
  {
    id: 'company-number',
    // Belgisch ondernemingsnummer: BE0xxx.xxx.xxx.
    pattern: /\bbe\s?0\d{3}\s?\d{3}\s?\d{3}\b/,
    weight: 0.9,
    reason: 'Belgisch ondernemingsnummer vermeld',
  },
  {
    id: 'legal-form',
    pattern: /\b(bvba|bv|nv|sprl|srl|sa|comm ?v|vof|cvba|gmbh)\b/,
    weight: 0.6,
    reason: 'Vennootschapsvorm in de naam of tekst',
  },
  {
    id: 'office-language',
    pattern: /\b(ons kantoor|notre agence|onze medewerkers|ons team|bezoek op afspraak via kantoor|via ons bureau)\b/,
    weight: 0.55,
    reason: 'Tekst spreekt namens een kantoor',
  },
  {
    id: 'portfolio-language',
    pattern: /\b(ons volledig aanbod|volledig aanbod op|meer panden op|ontdek ons aanbod|autres biens|our portfolio)\b/,
    weight: 0.7,
    reason: 'Verwijst naar een eigen aanbod van meerdere panden',
  },
  {
    id: 'epc-service-language',
    pattern: /\b(syndic|beheer van uw pand|verhuurbeheer|rentmeesterschap)\b/,
    weight: 0.4,
    reason: 'Biedt beheerdiensten aan',
  },
  {
    id: 'reference-code',
    // "Ref. 4820-A" is kantoortaal; particulieren nummeren hun woning niet.
    pattern: /\b(ref|referentie|reference|dossier)\s*[.:]?\s*[a-z]{0,3}[0-9]{3,}\b/,
    weight: 0.5,
    reason: 'Interne referentiecode zoals kantoren die gebruiken',
  },
]

/**
 * Woorden die zeggen: hier staat een particulier.
 *
 * "zonder makelaar" en "particulier à particulier" zijn de sterkste, want
 * niemand schrijft dat als het niet waar is — het is precies het verkoopargument
 * waarvoor de adverteerder de moeite neemt.
 */
export const PRIVATE_TEXT_SIGNALS: readonly Signal[] = [
  {
    id: 'no-agency-explicit',
    pattern: /\b(zonder makelaar|geen makelaar|niet via makelaar|sans agence|pas d agence|no agency|zonder immo|geen immokantoor)\b/,
    weight: 0.95,
    reason: 'Advertentie zegt expliciet "zonder makelaar"',
  },
  {
    id: 'private-explicit',
    pattern: /\b(particulier|van particulier|door particulier|prive verkoop|de particulier a particulier|particulier a particulier|entre particuliers|private sale|by owner|fsbo)\b/,
    weight: 0.9,
    reason: 'Advertentie noemt zichzelf een particuliere verkoop',
  },
  {
    id: 'owner-voice',
    pattern: /\b(eigen woning|onze woning|mijn woning|ons huis|mijn appartement|notre maison|ma maison|wij verkopen zelf|ik verkoop)\b/,
    weight: 0.7,
    reason: 'Eigenaar spreekt in de eerste persoon over de woning',
  },
  {
    id: 'no-commission',
    pattern: /\b(geen commissie|geen makelaarskosten|zonder commissie|sans commission|geen instapkosten)\b/,
    weight: 0.75,
    reason: 'Vermeldt afwezigheid van makelaarskosten',
  },
  {
    id: 'direct-contact',
    pattern: /\b(bel mij|bel me|contacteer mij|neem gerust contact met mij|appelez moi|contactez moi|na 18u|s avonds bereikbaar|na de werkuren)\b/,
    weight: 0.5,
    reason: 'Persoonlijke, niet-zakelijke contactinstructie',
  },
  {
    id: 'personal-reason',
    pattern: /\b(wegens verhuis|wegens verhuizing|wegens gezinsuitbreiding|wegens scheiding|nalatenschap|erfenis|cause demenagement|pour cause de)\b/,
    weight: 0.6,
    reason: 'Persoonlijke aanleiding voor de verkoop',
  },
]

/**
 * Namen die op een organisatie wijzen, toegepast op de *verkopersnaam* en niet
 * op de volledige tekst. Een beschrijving die "vlakbij Immo Center" zegt is
 * geen bewijs; een verkoper die "Immo Center" heet wel.
 */
export const PROFESSIONAL_NAME_SIGNALS: readonly Signal[] = [
  {
    id: 'name-immo',
    pattern: /\b(immo|immobilier|immobiliare|vastgoed|properties|property|realty|real estate|estate)\b/,
    weight: 0.9,
    reason: 'Verkopersnaam bevat een vastgoedterm',
  },
  {
    id: 'name-legal-form',
    pattern: /\b(bvba|bv|nv|sprl|srl|sa|cvba|vof|comm ?v|gmbh|ltd|group|groep|invest|holding)\b/,
    weight: 0.8,
    reason: 'Verkopersnaam bevat een vennootschaps- of groepsaanduiding',
  },
  {
    id: 'name-office',
    pattern: /\b(kantoor|agence|agency|bureau|partners|consulting|management|makelaars?)\b/,
    weight: 0.7,
    reason: 'Verkopersnaam klinkt als een kantoor',
  },
]

/**
 * Ontkende vermeldingen van een makelaar onschadelijk maken.
 *
 * ─── HET PROBLEEM DAT DIT OPLOST ─────────────────────────────────────────────
 *
 * Het sterkste particuliere signaal in Belgische advertenties is letterlijk
 * "zonder makelaar". Maar dat bevat het woord *makelaar*, en dat is óók het
 * sterkste professionele signaal. Zonder deze stap levert elke echte
 * FSBO-advertentie dus tegelijk zwaar bewijs voor beide kanten op, waarna de
 * motor hem op `unknown` of op een lage zekerheid zet — en precies de leads
 * waar de dienst voor bestaat gaan niet de deur uit.
 *
 * Hetzelfde geldt voor "geen makelaarskosten", "geen immokantoor",
 * "niet via makelaar", "sans agence" en "pas d'agence".
 *
 * De oplossing is de ontkende vermelding uit de tekst te knippen vóórdat de
 * professionele patronen erop losgelaten worden. De particuliere patronen
 * draaien op de ónbewerkte tekst en zien "zonder makelaar" dus gewoon staan.
 *
 * ─── DE PRIJS ────────────────────────────────────────────────────────────────
 *
 * Een kantoor dat schrijft "wij zijn geen gewoon vastgoedkantoor" verliest
 * daarmee één signaal. Dat is een bewuste ruil: die formulering is zeldzaam, en
 * zo'n kantoor valt alsnog door de mand op zijn naam, zijn BIV-nummer of zijn
 * aantal advertenties — drie signalen die deze functie niet aanraakt.
 */
const NEGATED_AGENCY_MENTION =
  /\b(?:zonder|geen|niet via|niet door|nooit via|sans|pas d|pas de|no|without)\s+(?:\w+\s+){0,2}?(?:makelaar\w*|immo\w*|vastgoedkantoor\w*|immobilienkantoor\w*|makelaarskantoor\w*|agence\w*|agent immobilier|courtier\w*|kantoor\w*|tussenpersoon\w*|agency|agent)\b/g

export function stripNegatedAgencyMentions(normalizedText: string): string {
  return normalizedText.replace(NEGATED_AGENCY_MENTION, ' ')
}

/**
 * Een verkopersnaam die eruitziet als een persoon: "Jan", "Jan Peeters",
 * "Marie-Claire D." Twee tot drie korte woorden zonder cijfers.
 *
 * Bewust conservatief. Deze test bevestigt een particulier, hij bewijst er geen:
 * "Vastgoed Peeters" is ook twee woorden. Daarom wordt hij in de motor alleen
 * meegeteld als er géén professioneel naamsignaal is.
 */
export function looksLikePersonalName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 45) return false
  if (/\d/.test(trimmed)) return false
  if (/[@/|]|www\.|\.be\b|\.com\b/i.test(trimmed)) return false

  const words = trimmed.split(/\s+/)
  if (words.length > 3) return false

  // Een naam in kapitalen ("IMMO CENTER") is kantoorbranding, geen voornaam.
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 3 && letters === letters.toUpperCase()) return false

  return words.every((word) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.-]{0,19}$/.test(word))
}
