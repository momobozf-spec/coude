import type { Language } from '../types/common';
import { tokenize } from '../util/text';

/**
 * Stop-word based language detection for short commands.
 * The device locale is used as a prior and as tie-breaker; speech recognition
 * already runs per-locale, so this mainly serves typed input.
 */

const MARKERS: Record<Language, string[]> = {
  en: ['i', 'me', 'my', 'to', 'the', 'a', 'an', 'at', 'tomorrow', 'today', 'remind', 'put', 'and', 'for', 'on', 'with', 'in', 'need', 'what', 'do', 'set', 'add', 'call', 'meeting', 'idea', 'have', 'wake', 'timer', 'next', 'this', 'from', 'until', 'is', 'that', 'about', 'buy', 'note', 'remember', 'find', 'search', 'every', 'morning', 'evening', 'minutes', 'hour', 'hours', 'up', 'alarm'],
  nl: ['ik', 'mij', 'me', 'om', 'morgen', 'moet', 'een', 'het', 'de', 'en', 'niet', 'op', 'van', 'in', 'te', 'dat', 'met', 'is', 'zet', 'mijn', 'herinner', 'uur', 'maak', 'wakker', 'idee', 'agenda', 'bellen', 'kopen', 'wat', 'vandaag', 'over', 'voor', 'nog', 'naar', 'heb', 'onthoud', 'noteer', 'elke', 'ochtend', 'avond', 'minuten', 'half', 'kwart', 'vergadering', 'afspraak', 'taak', 'taken', 'zoek'],
  fr: ['je', 'moi', 'me', 'mon', 'ma', 'mes', 'le', 'la', 'les', 'à', 'de', 'des', 'demain', 'rappelle', 'mets', 'et', 'pour', 'avec', 'dans', 'que', 'il', 'faut', 'dois', 'idée', 'idee', 'réunion', 'reunion', 'appeler', 'acheter', 'heures', 'minuteur', 'réveille', 'reveille', 'note', 'cherche', 'trouve', 'quoi', "aujourd'hui", 'ce', 'soir', 'matin', 'minutes', 'une', 'un', 'planifie', 'agenda', 'tâches', 'taches'],
};

const UNIQUE_HINTS: Record<Language, RegExp> = {
  en: /\b(?:remind me|wake me|what did i|i need to|i have to|set a timer|tomorrow|o'clock)\b/i,
  nl: /\b(?:herinner mij|herinner me|maak mij|maak me|ik moet|wat moet ik|morgen om|half \w+|kwart (?:over|voor)|in mijn agenda|ik heb een idee)\b/i,
  fr: /\b(?:rappelle-moi|rappelle moi|réveille-moi|reveille-moi|je dois|il faut que|qu'est-ce que|demain à|mets un|j'ai une idée)\b/i,
};

export interface LanguageGuess {
  language: Language;
  confidence: number;
  scores: Record<Language, number>;
}

export function detectLanguage(text: string, prior: Language = 'en'): LanguageGuess {
  const tokens = tokenize(text);
  const scores: Record<Language, number> = { en: 0, nl: 0, fr: 0 };
  for (const lang of ['en', 'nl', 'fr'] as const) {
    const markers = new Set(MARKERS[lang]);
    for (const token of tokens) if (markers.has(token)) scores[lang] += 1;
    if (UNIQUE_HINTS[lang].test(text)) scores[lang] += 3;
  }
  scores[prior] += 0.5;
  let best: Language = prior;
  let bestScore = -1;
  let total = 0;
  for (const lang of ['en', 'nl', 'fr'] as const) {
    total += scores[lang];
    if (scores[lang] > bestScore) {
      best = lang;
      bestScore = scores[lang];
    }
  }
  const confidence = total === 0 ? 0.3 : Math.min(1, bestScore / total);
  return { language: best, confidence, scores };
}
