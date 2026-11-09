/**
 * Juridische grenzen aan documentuitleg.
 *
 * ─── DE REGEL ────────────────────────────────────────────────────────────────
 *
 * Halal Home legt uit. Het adviseert niet, het keurt niet goed, en het vervangt
 * geen notaris of advocaat.
 *
 * Dat verschil is niet stilistisch. "Deze clausule lijkt te gaan over de
 * opschortende voorwaarde" is informatie. "Dit contract is in orde, je kan
 * tekenen" is een juridisch oordeel, en wie daarop afgaat en verkeerd zit,
 * heeft geen verhaal — behalve bij ons.
 *
 * ─── WAAROM DIT IN CODE STAAT EN NIET IN EEN PROMPT ──────────────────────────
 *
 * Een systeemprompt is een verzoek. Een taalmodel kan hem negeren, en bij een
 * ongelukkig geformuleerde vraag doet het dat ook. `assertNoLegalAdvice()`
 * draait ná de generatie over de werkelijke output, en weigert wat er niet
 * doorheen mag. De prompt vraagt; deze functie beslist.
 *
 * ─── WAT DIT IS: EEN HEURISTIEK, GEEN GARANTIE ───────────────────────────────
 *
 * Lees dit voordat je ergens noteert dat "juridisch advies geblokkeerd wordt".
 * Dat staat hier niet, en het zou niet waar zijn.
 *
 * Dit is een deterministisch tekstfilter op basis van reguliere expressies. Het
 * herkent formuleringen die wij hebben bedacht. Het begrijpt niets. Alles wat
 * een juridisch oordeel is zonder een van deze woordcombinaties te bevatten,
 * komt er ongehinderd doorheen — bijvoorbeeld:
 *
 *   - een omschrijving zonder de gemarkeerde werkwoorden ("er staat niets in
 *     dat je zou tegenhouden");
 *   - hetzelfde oordeel in het Frans, Engels of Arabisch;
 *   - een oordeel dat over meerdere zinnen verspreid staat;
 *   - een impliciete geruststelling ("dit is een standaardclausule, daar zit
 *     nooit iets achter").
 *
 * Elk van die vier is juridisch advies. Geen enkele wordt hier tegengehouden.
 *
 * ─── DE VIER LAGEN, EN WAT ELKE LAAG NIET KAN ────────────────────────────────
 *
 *   1. systeeminstructie aan het model — stuurt, maar is een verzoek dat
 *      genegeerd kan worden;
 *   2. gestructureerde output (vaste velden in plaats van vrije tekst) —
 *      beperkt de vórm, niet de inhoud van een veld;
 *   3. dit deterministische filter — vangt bekende formuleringen, mist alles
 *      wat we niet bedacht hebben;
 *   4. de disclaimer in de UI, boven de uitleg en niet eronder — informeert de
 *      gebruiker, maar houdt niets tegen.
 *
 * Geen van deze vier is op zichzelf voldoende, en samen zijn ze dat ook niet.
 * Ze verkleinen de kans en de ernst; ze sluiten niets uit. De laag waar het
 * uiteindelijk op aankomt is de vierde: de gebruiker weet dat hij naar uitleg
 * kijkt en niet naar een oordeel.
 *
 * Praktisch gevolg voor wie hieraan werkt: behandel een gemiste zin als een
 * bekend risico, niet als een defect in dit bestand. Een patroon toevoegen mag
 * en helpt, maar het verandert niets aan de aard van de bescherming. Wat de
 * aard wél zou veranderen is menselijke review vóór publicatie — en die is er
 * niet.
 */

export const EXPLANATION_VERSION = 1

/**
 * De disclaimer die bij élke uitleg hoort.
 *
 * Verplicht veld in `DocumentExplanation`, niet een string die een component
 * mag vergeten.
 */
export const EXPLANATION_DISCLAIMER =
  'Dit is een vereenvoudigde uitleg, geen juridisch advies. Halal Home beoordeelt niet of ' +
  'een document juridisch in orde is en vervangt je notaris of advocaat niet. Laat altijd ' +
  'bevestigen wat dit concreet voor jouw situatie betekent voordat je iets ondertekent.'

/**
 * Formuleringen die nooit in een uitleg mogen staan.
 *
 * Twee soorten: uitspraken over juridische geldigheid, en aansporingen om te
 * tekenen of juist niet. Beide zijn oordelen die alleen een professional mag
 * geven na inzage in het volledige dossier.
 *
 * De patronen zijn bewust breed. Een valse positief kost een hergeneratie; een
 * gemiste zin kost iemand zijn rechtsbescherming.
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(juridisch|wettelijk)\s+(in orde|correct|geldig|veilig|sluitend|waterdicht)\b/i,
    reason: 'uitspraak over juridische geldigheid',
  },
  {
    pattern: /\bdit contract is (in orde|veilig|correct|geldig)\b/i,
    reason: 'goedkeuring van een contract',
  },
  {
    // Meerdere vulwoorden tussen werkwoord en "tekenen": "je kan dit gerust
    // veilig ondertekenen". Eén optionele groep zou dat missen.
    pattern: /\b(je|u) (kan|kunt|mag)(\s+\w+){0,3}\s+(onder)?tekenen\b/i,
    reason: 'aansporing om te ondertekenen',
  },
  {
    pattern: /\bteken (dit|het|deze)\b/i,
    reason: 'aansporing om te ondertekenen',
  },
  {
    pattern: /\b(niet|nooit) (onder)?tekenen\b/i,
    reason: 'juridisch advies om niet te ondertekenen',
  },
  {
    pattern: /\b(ik|wij) (adviseer|adviseren|raad|raden) (je|u) (aan|af)\b/i,
    reason: 'advies in eigen naam',
  },
  {
    pattern: /\bje hebt (hier )?(geen|een) (juridisch )?(recht|aanspraak) op\b/i,
    reason: 'uitspraak over rechten',
  },
  {
    pattern: /\b(er is|dit is) geen (enkel )?risico\b/i,
    reason: 'geruststelling over risico',
  },
  {
    pattern: /\bgarande(er|ren)\b|\bwij garanderen\b/i,
    reason: 'garantie',
  },
  {
    pattern: /\bhoeft? (geen|niet naar de) (notaris|advocaat)\b/i,
    reason: 'suggestie dat een professional overbodig is',
  },
]

export interface GuardrailViolation {
  field: string
  matched: string
  reason: string
}

/**
 * Woorden die van een bewering een ontkenning maken.
 *
 * Zonder deze controle zou onze eigen disclaimer afgekeurd worden: "Halal Home
 * beoordeelt **niet** of een document juridisch in orde is" bevat letterlijk de
 * verboden woordcombinatie, maar zegt het tegenovergestelde.
 *
 * ─── DE BEPERKING, EERLIJK ───────────────────────────────────────────────────
 *
 * Dit is een heuristiek, geen taalanalyse. Hij kijkt of er vlak vóór de match
 * een ontkenning staat. Een constructie als "het is niet zo dat dit contract
 * níet juridisch in orde is" glipt erdoor.
 *
 * Die beperking is aanvaardbaar omdat dit de tweede verdedigingslinie is: de
 * systeeminstructie vraagt om zulke formuleringen niet te gebruiken, en een
 * mens leest de fixture-teksten na. Wat deze functie moet vangen is de gewone
 * fout — een model dat rechttoe rechtaan een oordeel velt — en dat doet hij.
 */
const NEGATION_WORDS = /\b(niet|geen|nooit|beoordeelt|beoordelen|of het|of een|of dit)\b/i

/** Hoeveel tekens vóór de match we op een ontkenning controleren. */
const NEGATION_WINDOW = 60

function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex)
  return NEGATION_WORDS.test(before)
}

/**
 * Doorzoekt een uitleg op verboden formuleringen.
 *
 * Geeft de gevonden overtredingen terug in plaats van te gooien, zodat de
 * aanroeper kan kiezen: opnieuw genereren, of terugvallen op een veilige
 * variant.
 */
export function findLegalAdvice(explanation: {
  summary: string
  keyPoints: string[]
  attentionPoints: string[]
  questionsForProfessional: string[]
}): GuardrailViolation[] {
  const violations: GuardrailViolation[] = []

  const check = (field: string, text: string) => {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      const match = pattern.exec(text)
      if (!match) continue
      // "beoordeelt niet of dit juridisch in orde is" is geen oordeel.
      if (isNegated(text, match.index)) continue

      violations.push({ field, matched: match[0], reason })
    }
  }

  check('summary', explanation.summary)
  explanation.keyPoints.forEach((text, i) => check(`keyPoints[${i}]`, text))
  explanation.attentionPoints.forEach((text, i) => check(`attentionPoints[${i}]`, text))
  explanation.questionsForProfessional.forEach((text, i) =>
    check(`questionsForProfessional[${i}]`, text),
  )

  return violations
}

export class LegalGuardrailError extends Error {
  readonly violations: GuardrailViolation[]

  constructor(violations: GuardrailViolation[]) {
    super(
      `De gegenereerde uitleg bevat ${violations.length} formulering(en) die als juridisch advies kunnen worden gelezen: ` +
        violations.map((v) => `${v.field} (${v.reason})`).join(', '),
    )
    this.name = 'LegalGuardrailError'
    this.violations = violations
  }
}

export function assertNoLegalAdvice(explanation: {
  summary: string
  keyPoints: string[]
  attentionPoints: string[]
  questionsForProfessional: string[]
}): void {
  const violations = findLegalAdvice(explanation)
  if (violations.length > 0) throw new LegalGuardrailError(violations)
}

/**
 * De systeeminstructie voor een taalmodel.
 *
 * Vraagt om precies wat mag. Is geen garantie — daarvoor is
 * `assertNoLegalAdvice` — maar scheelt hergeneraties.
 */
export const EXPLANATION_SYSTEM_PROMPT = `Je legt Belgische vastgoed- en financieringsdocumenten uit aan iemand die geen jurist is.

WAT JE WEL DOET:
- de strekking van het document in gewone taal samenvatten;
- moeilijke termen uitleggen;
- aanwijzen welke onderdelen aandacht verdienen;
- vragen voorstellen die de lezer aan zijn notaris of advocaat kan stellen.

WAT JE NOOIT DOET:
- zeggen dat een document juridisch in orde, geldig, veilig of sluitend is;
- aanraden om wel of niet te ondertekenen;
- bindende conclusies trekken over rechten of verplichtingen;
- suggereren dat een notaris of advocaat overbodig is;
- garanties geven of zeggen dat er geen risico is.

FORMULERING:
Gebruik voorzichtige, beschrijvende taal. Schrijf "deze clausule lijkt te gaan over…" en
"laat je notaris bevestigen wat dit voor jouw situatie betekent", niet "dit betekent dat…".

Verzin niets. Staat iets niet in het document, zeg dan dat het er niet in staat.

Antwoord uitsluitend met JSON.`
