import { getLexicon } from '../date/lexicon';
import type { Language } from '../types/common';

/**
 * Extracts people and locations from the *cased* input text.
 * Speech-to-text engines capitalise proper names, which is the strongest
 * signal we have without a contacts lookup (which we deliberately do not do).
 */

const PERSON_CUES: Record<Language, RegExp> = {
  en: /\b(?:with|call|phone|email|text|ask|tell|meet|meeting with|dinner with|lunch with|from|for)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)/gu,
  nl: /\b(?:met|bel|mail|vraag|zeg|van|voor|aan)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)|([A-Z][\p{L}'’-]+)\s+(?:bellen|mailen|contacteren)/gu,
  fr: /\b(?:avec|appeler|appelle|envoyer|demander|dire|à|a|de|pour|chez)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)/gu,
};

const LOCATION_CUES: Record<Language, RegExp> = {
  en: /\b(?:at|in)\s+((?:the\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})\s*$/u,
  nl: /\b(?:bij|in|op)\s+((?:de\s+|het\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})\s*$/u,
  fr: /\b(?:chez|au|à la|à|a|dans)\s+((?:le\s+|la\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})\s*$/u,
};

const COMMON_CAPITALS = new Set([
  'i', 'siri', 'brainvoice', 'bol.com', 'ok', 'okay', 'google', 'apple', 'android', 'ios', 'api', 'pdf', 'ai', 'la', 'le', 'de', 'het',
]);

function isStopWord(word: string, language: Language): boolean {
  const lower = word.toLowerCase();
  if (COMMON_CAPITALS.has(lower)) return true;
  const lex = getLexicon(language);
  if (lex.weekdays.some(([w]) => w === lower)) return true;
  if (lex.months.some(([m]) => m === lower)) return true;
  if (lex.relativeDays.some(([d]) => d === lower)) return true;
  return false;
}

export function extractPeople(casedText: string, language: Language, opts: { allowSentenceStart?: boolean } = {}): string[] {
  const people = new Set<string>();
  const cue = new RegExp(PERSON_CUES[language].source, PERSON_CUES[language].flags);
  let m: RegExpExecArray | null;
  while ((m = cue.exec(casedText)) !== null) {
    const name = (m[1] ?? m[2] ?? '').trim();
    if (name && !isStopWord(name, language)) people.add(name);
  }
  // Fallback: capitalised tokens that are not sentence-initial.
  const tokens = casedText.split(/\s+/);
  for (let i = opts.allowSentenceStart ? 0 : 1; i < tokens.length; i++) {
    const raw = tokens[i] ?? '';
    const token = raw.replace(/[.,;:!?()"]/g, '');
    if (!token || token.length < 2) continue;
    if (!/^[A-Z][\p{Ll}'’-]+$/u.test(token)) continue;
    const prev = (tokens[i - 1] ?? '').replace(/[.,;:!?()"]/g, '');
    if (i > 0 && /[.!?]$/.test(tokens[i - 1] ?? '') && !opts.allowSentenceStart) continue; // sentence start
    if (isStopWord(token, language)) continue;
    if (/^(?:the|de|het|le|la|les|een|a|an|un|une)$/i.test(prev)) continue; // "the Dashboard"
    people.add(token);
  }
  return Array.from(people).slice(0, 5);
}

export function extractLocation(casedRemaining: string, language: Language): { location: string | null; title: string } {
  const m = LOCATION_CUES[language].exec(casedRemaining);
  if (!m || !m[1]) return { location: null, title: casedRemaining };
  const location = m[1].trim();
  if (isStopWord(location, language)) return { location: null, title: casedRemaining };
  const title = casedRemaining.slice(0, m.index).trim();
  if (title.length < 2) return { location: null, title: casedRemaining };
  return { location, title };
}

/** Re-applies the original capitalisation of proper nouns to a lower-cased title. */
export function recase(lowerTitle: string, casedSource: string): string {
  const dictionary = new Map<string, string>();
  const tokens = casedSource.split(/\s+/);
  tokens.forEach((raw, index) => {
    const token = raw.replace(/^[("'«]+|[.,;:!?)"'»]+$/g, '');
    if (!token) return;
    const isSentenceStart = index === 0 || /[.!?]$/.test(tokens[index - 1] ?? '');
    if (/^[A-Z]/.test(token) && !isSentenceStart) dictionary.set(token.toLowerCase(), token);
    // Keep all-caps acronyms and mixed-case brand names even at sentence start.
    if (/^[A-Z]{2,}$/.test(token) || /^[a-z]+[A-Z]/.test(token)) dictionary.set(token.toLowerCase(), token);
  });
  return lowerTitle
    .split(' ')
    .map((word) => {
      const stripped = word.replace(/^[("'«]+|[.,;:!?)"'»]+$/g, '');
      const cased = dictionary.get(stripped);
      return cased ? word.replace(stripped, cased) : word;
    })
    .join(' ');
}
