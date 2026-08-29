/**
 * Guard against the one marketing lie this product must never tell.
 *
 * RailClaim prepares a dossier; the user confirms and files it (ADR 0001).
 * Any copy promising automatic filing or automatic money would misrepresent
 * what the system does. This runs over the i18n message files in CI, so the
 * claim cannot creep back in through a copy tweak.
 */

export interface HonestyViolation {
  locale: string
  key: string
  phrase: string
  text: string
}

/**
 * Phrases that assert we file the claim, or that money arrives automatically.
 * Matched case-insensitively against the message values.
 */
const BANNED_PATTERNS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /automatisch\s+(je\s+)?geld\s+terug/i,
    why: 'promises money back automatically',
  },
  {
    pattern: /automatische\s+compensatie/i,
    why: 'promises automatic compensation',
  },
  {
    pattern: /wij\s+dienen\s+(je|uw|jouw)\s+\w*\s*(claim|dossier|aanvraag)?\s*in\b/i,
    why: 'claims we file on the user behalf',
  },
  {
    pattern: /automatisch\s+ingediend/i,
    why: 'claims the dossier is filed automatically',
  },
  {
    pattern: /wij\s+claimen\s+voor\s+(je|jou|u)/i,
    why: 'claims we file on the user behalf',
  },
  {
    pattern: /argent\s+remboursé\s+automatiquement/i,
    why: 'promises money back automatically (FR)',
  },
  {
    pattern: /compensation\s+automatique/i,
    why: 'promises automatic compensation (FR)',
  },
  {
    pattern: /nous\s+introduisons\s+(votre|la)\s+(demande|dossier)\s+(à\s+votre\s+place)?/i,
    why: 'claims we file on the user behalf (FR)',
  },
  {
    pattern: /introduit\s+automatiquement/i,
    why: 'claims the dossier is filed automatically (FR)',
  },
]

/**
 * Sentences that explicitly DENY doing something are fine — "wij dienen niet
 * in jouw plaats in" must not trip the guard that looks for "wij dienen ... in".
 */
const NEGATION_MARKERS = [
  /\bniet\b/i,
  /\bnooit\b/i,
  /\bgeen\b/i,
  /\bzonder\b/i,
  /\bne\s+\w+\s+pas\b/i,
  /\bjamais\b/i,
  /\baucun/i,
]

function isNegated(text: string): boolean {
  return NEGATION_MARKERS.some((marker) => marker.test(text))
}

function walk(
  value: unknown,
  path: string[],
  visit: (key: string, text: string) => void,
): void {
  if (typeof value === 'string') {
    visit(path.join('.'), value)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, [...path, key], visit)
    }
  }
}

export function findHonestyViolations(
  messagesByLocale: Record<string, unknown>,
): HonestyViolation[] {
  const violations: HonestyViolation[] = []

  for (const [locale, messages] of Object.entries(messagesByLocale)) {
    walk(messages, [], (key, text) => {
      if (isNegated(text)) return
      for (const { pattern, why } of BANNED_PATTERNS) {
        if (pattern.test(text)) {
          violations.push({ locale, key, phrase: why, text })
        }
      }
    })
  }

  return violations
}

/** Every locale must define exactly the same keys — no half-translated UI. */
export function findKeyMismatches(
  messagesByLocale: Record<string, unknown>,
): string[] {
  const keysByLocale = new Map<string, Set<string>>()

  for (const [locale, messages] of Object.entries(messagesByLocale)) {
    const keys = new Set<string>()
    walk(messages, [], (key) => keys.add(key))
    keysByLocale.set(locale, keys)
  }

  const locales = [...keysByLocale.keys()]
  if (locales.length < 2) return []

  const [reference, ...others] = locales
  const referenceKeys = keysByLocale.get(reference)!
  const problems: string[] = []

  for (const locale of others) {
    const keys = keysByLocale.get(locale)!
    for (const key of referenceKeys) {
      if (!keys.has(key)) problems.push(`${locale} is missing "${key}" (present in ${reference})`)
    }
    for (const key of keys) {
      if (!referenceKeys.has(key)) problems.push(`${locale} has extra key "${key}"`)
    }
  }

  return problems
}
