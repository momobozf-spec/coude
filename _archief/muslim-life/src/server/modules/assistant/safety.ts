/**
 * Assistant safety.
 *
 * Two jobs, both done before the provider is called:
 *
 *  1. Classify what kind of question this is, so a request for a personal
 *     religious ruling is handled differently from "plan my week".
 *  2. Neutralise untrusted text so content from a listing or an imported plan
 *     cannot act as an instruction.
 *
 * Deliberately rule-based and deterministic. Safety that depends on a model call
 * fails exactly when the model is having a bad day, and cannot be unit-tested.
 * The model is asked to cooperate through the system prompt as well, but the
 * classification that drives our behaviour happens here, in code we control.
 */

export type ReligiousQueryType =
  | 'NON_RELIGIOUS'
  | 'GENERAL_ISLAMIC_INFO'
  | 'QURAN_HADITH_EXPLANATION'
  | 'FIQH'
  | 'FATWA_REQUEST'
  | 'PERSONAL_RELIGIOUS_RULING'

export interface SafetyAssessment {
  queryType: ReligiousQueryType
  /** True when the reply must carry a "scholars differ" note. */
  requiresDisclaimer: boolean
  /** True when the assistant must not give a binding answer at all. */
  requiresScholarReferral: boolean
  /** Matched signals, for auditing why a classification happened. */
  signals: string[]
}

/** Terms that make a question religious at all. */
const RELIGIOUS_TERMS = [
  'islam', 'islamic', 'muslim', 'quran', "qur'an", 'koran', 'hadith', 'sunnah', 'sunna',
  'prophet', 'allah', 'shariah', 'sharia', 'fiqh', 'madhab', 'madhhab', 'scholar', 'sheikh',
  'imam', 'mufti', 'fatwa', 'halal', 'haram', 'makruh', 'mustahabb', 'wajib', 'fard', 'sunnah',
  'salah', 'salat', 'prayer', 'namaz', 'wudu', 'ghusl', 'zakat', 'sadaqah', 'ramadan', 'fasting',
  'sawm', 'hajj', 'umrah', 'eid', 'jumuah', "jumu'ah", 'dua', 'dhikr', 'adhkar', 'niyyah',
  'riba', 'nikah', 'talaq', 'mahram', 'awrah', 'hijab', 'niqab', 'janaza', 'aqeedah',
  // Scripture references are religious even when no other marker is present —
  // "explain Surah Al-Fatiha" mentions none of the words above.
  'surah', 'surat', 'ayah', 'ayat', 'tafsir', 'tafseer', 'juz', 'rakah', "rak'ah", 'raka',
  // Dutch, because the first market types in it.
  'islamitisch', 'moslim', 'koran', 'gebed', 'vasten', 'geleerde', 'toegestaan', 'verboden',
]

/** Asking for a ruling, rather than for information. */
const RULING_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bis (it|this|that) (halal|haram|permissible|allowed|forbidden)\b/i, label: 'is-it-halal' },
  { pattern: /\b(am|are) i (allowed|permitted|obliged|required)\b/i, label: 'am-i-allowed' },
  { pattern: /\b(can|may) i .{0,60}\b(islam|islamic|religious|shariah|sharia)\b/i, label: 'may-i-religious' },
  { pattern: /\bdo i (have to|need to|must)\b.{0,60}\b(pray|fast|zakat|repeat|make up|qada)\b/i, label: 'do-i-have-to' },
  { pattern: /\bshould i (repeat|redo|make up)\b.{0,40}\b(prayer|salah|salat|fast)\b/i, label: 'repeat-worship' },
  { pattern: /\b(is|was) my (prayer|salah|salat|fast|wudu|marriage|nikah|contract|divorce)\b.{0,40}\b(valid|invalid|accepted|broken)\b/i, label: 'validity-of-mine' },
  { pattern: /\bgive me a (fatwa|ruling)\b/i, label: 'explicit-fatwa' },
  { pattern: /\bwhat (is|'s) the (ruling|hukm)\b/i, label: 'what-is-the-ruling' },
  { pattern: /\bis (my|our) .{0,40}\b(riba|usury|interest)\b/i, label: 'riba-personal' },
  { pattern: /\b(mag ik|moet ik|is het toegestaan|is dit haram|is dit halal)\b/i, label: 'ruling-nl' },
  { pattern: /\bmag ik .{0,60}\b(scheiden|trouwen|volgens de islam)\b/i, label: 'ruling-nl-personal' },
]

/** Personal framing — "my", "I", "our" — which turns theory into a ruling request. */
const PERSONAL_MARKERS = /\b(i|my|mine|me|we|our|us|ik|mijn|mij|we|ons|onze)\b/i

/** Topics where scholarly positions genuinely differ. */
const CONTESTED_TOPICS = [
  'music', 'insurance', 'mortgage', 'interest', 'riba', 'crypto', 'stocks', 'shares',
  'combining prayers', 'qasr', 'shortening prayer', 'travel prayer', 'moon sighting',
  'hijab', 'niqab', 'beard', 'photography', 'images', 'gelatin', 'vanilla extract',
  'meat of the people of the book', 'ahl al-kitab', 'tarawih', 'witr', 'qunut',
  'wiping over socks', 'khuff', 'ijtihad', 'taqlid',
]

const QURAN_HADITH_PATTERNS = [
  /\b(surah|surat|ayah|ayat|verse)\b/i,
  /\bquran \d+:\d+/i,
  /\b(explain|meaning of|tafsir|tafseer)\b.{0,40}\b(verse|ayah|hadith|surah)\b/i,
]

function includesAny(haystack: string, needles: string[]): string[] {
  const lower = haystack.toLowerCase()
  return needles.filter((needle) => lower.includes(needle))
}

/**
 * Classify a member's message.
 *
 * Errs toward caution: an ambiguous religious question with personal framing is
 * treated as a ruling request. Over-referring to a scholar is a mild annoyance;
 * under-referring means an app handed someone a fatwa.
 */
export function classifyQuery(message: string): SafetyAssessment {
  const signals: string[] = []
  const religiousTerms = includesAny(message, RELIGIOUS_TERMS)

  const rulingMatches = RULING_PATTERNS.filter(({ pattern }) => pattern.test(message))
  for (const match of rulingMatches) signals.push(`ruling:${match.label}`)

  const contested = includesAny(message, CONTESTED_TOPICS)
  for (const topic of contested) signals.push(`contested:${topic}`)

  const isPersonal = PERSONAL_MARKERS.test(message)
  const mentionsReligion = religiousTerms.length > 0
  if (mentionsReligion) signals.push(`religious:${religiousTerms.slice(0, 3).join(',')}`)

  // Explicit request for a ruling.
  if (rulingMatches.length > 0) {
    const queryType: ReligiousQueryType = isPersonal
      ? 'PERSONAL_RELIGIOUS_RULING'
      : 'FATWA_REQUEST'

    return {
      queryType,
      requiresDisclaimer: true,
      requiresScholarReferral: true,
      signals,
    }
  }

  // Checked before the non-religious exit: a scripture question may carry no
  // other religious vocabulary at all.
  const isScripture = QURAN_HADITH_PATTERNS.some((pattern) => pattern.test(message))

  if (!mentionsReligion && !isScripture) {
    return {
      queryType: 'NON_RELIGIOUS',
      requiresDisclaimer: false,
      requiresScholarReferral: false,
      signals,
    }
  }

  if (isScripture) {
    signals.push('quran-hadith')
    return {
      queryType: 'QURAN_HADITH_EXPLANATION',
      // Explaining a verse is not a ruling, but the model must not present
      // itself as the source.
      requiresDisclaimer: true,
      requiresScholarReferral: false,
      signals,
    }
  }

  // A contested topic asked about personally is a ruling request in practice,
  // whatever grammar it uses.
  if (contested.length > 0) {
    return {
      queryType: isPersonal ? 'PERSONAL_RELIGIOUS_RULING' : 'FIQH',
      requiresDisclaimer: true,
      requiresScholarReferral: isPersonal,
      signals,
    }
  }

  return {
    queryType: 'GENERAL_ISLAMIC_INFO',
    requiresDisclaimer: false,
    requiresScholarReferral: false,
    signals,
  }
}

// ─── Prompt injection ────────────────────────────────────────────────────────

/**
 * Wrap untrusted text so the model treats it as data.
 *
 * Regex stripping alone is not a defence — it is trivially bypassed. The real
 * defences are structural and layered:
 *
 *  - untrusted content is fenced and explicitly labelled as data
 *  - the system prompt states that fenced content is never an instruction
 *  - generators return schema-validated structured output, so prose cannot
 *    become an action
 *  - actions are a closed server-side allowlist, never a model-chosen name
 *  - nothing the model produces writes to the database without confirmation
 *
 * The escaping below only stops a delimiter being closed early.
 */
export function fenceUntrusted(label: string, content: string): string {
  const safe = content
    // Prevent breaking out of the fence.
    .replace(/<\/?untrusted[^>]*>/gi, '')
    // Neutralise the most common override phrasings so they read as text.
    .replace(/\bignore (all |any )?(previous|prior|above)\b/gi, '[filtered]')
    .replace(/\bdisregard (all |any )?(previous|prior|above)\b/gi, '[filtered]')
    .replace(/\byou are now\b/gi, '[filtered]')
    .replace(/\bsystem prompt\b/gi, '[filtered]')
    .slice(0, 4000)

  return `<untrusted source="${label}">\n${safe}\n</untrusted>`
}

/** Signals that a piece of untrusted text was trying to issue instructions. */
export function detectInjectionAttempt(content: string): boolean {
  const patterns = [
    /\bignore (all |any )?(previous|prior|above) (instructions|prompts?)\b/i,
    /\bdisregard (all |any )?(previous|prior|above)\b/i,
    /\byou are now\b/i,
    /\bsystem prompt\b/i,
    /\bnew instructions?:/i,
    /\bact as (if you are )?(a |an )?(different|new)\b/i,
    /<\/?(system|assistant)>/i,
  ]

  return patterns.some((pattern) => pattern.test(content))
}

// ─── Disclaimers ─────────────────────────────────────────────────────────────

export const SCHOLAR_REFERRAL_NOTE =
  'This depends on details of your situation, and scholars differ on questions like it. Please put it to a qualified scholar who can ask you the follow-up questions — I can help you organise whatever you decide.'

export const SCHOLARLY_DIFFERENCE_NOTE =
  'There are different scholarly opinions on this. What follows is general information, not a ruling.'

/**
 * Append the note the assessment requires.
 *
 * Deliberately not appended to every religious sentence — a disclaimer on
 * everything is noise that people learn to skip, which makes it useless exactly
 * when it matters.
 */
export function applyDisclaimer(text: string, assessment: SafetyAssessment): string {
  if (assessment.requiresScholarReferral) {
    if (text.toLowerCase().includes('qualified scholar')) return text
    return `${text}\n\n---\n\n${SCHOLAR_REFERRAL_NOTE}`
  }

  if (assessment.requiresDisclaimer) {
    if (text.toLowerCase().includes('scholars differ')) return text
    return `${text}\n\n---\n\n${SCHOLARLY_DIFFERENCE_NOTE}`
  }

  return text
}
