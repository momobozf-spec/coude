import type { Language } from '../types/common';
import { tokenize, truncate } from '../util/text';

/**
 * Lightweight keyword classifier for categories, tags and suggested titles.
 * Used by the deterministic parser so that captures are organised automatically
 * even when no LLM is available. The LLM parser can override these values.
 */

export const DEFAULT_CATEGORIES = [
  'Work',
  'Personal',
  'Business',
  'Shopping',
  'Ideas',
  'People',
  'Finance',
  'Health',
  'Travel',
  'Uncategorized',
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

const KEYWORDS: Record<Exclude<DefaultCategory, 'Uncategorized' | 'People' | 'Ideas'>, string[]> = {
  Work: [
    'meeting', 'project', 'dashboard', 'client', 'deadline', 'report', 'sprint', 'team', 'manager', 'colleague', 'office', 'presentation',
    'databricks', 'api', 'documentation', 'ticket', 'release', 'deploy', 'server', 'backlog', 'stakeholder', 'kpi', 'risks', 'risk',
    'vergadering', 'collega', 'kantoor', 'presentatie', 'rapport', 'klant', 'werk', 'baas', 'projet', 'réunion', 'reunion', 'bureau', 'collègue', 'collegue', 'rapport', 'travail',
  ],
  Business: [
    'app', 'startup', 'product', 'products', 'market', 'opportunity', 'opportunities', 'customers', 'revenue', 'business', 'pricing', 'launch', 'saas',
    'bol.com', 'amazon', 'webshop', 'shop', 'store', 'scanner', 'platform', 'marktplaats', 'onderneming', 'zaak', 'entreprise', 'marché', 'marche', 'produit', 'produits',
  ],
  Shopping: [
    'buy', 'milk', 'bread', 'groceries', 'grocery', 'supermarket', 'shopping', 'eggs', 'butter', 'cheese', 'vegetables', 'fruit',
    'kopen', 'melk', 'brood', 'boodschappen', 'supermarkt', 'eieren', 'kaas', 'groenten', 'acheter', 'lait', 'pain', 'courses', 'supermarché', 'supermarche', 'oeufs', 'fromage',
  ],
  Finance: [
    'invoice', 'invoices', 'payment', 'pay', 'tax', 'taxes', 'accountant', 'bank', 'budget', 'salary', 'money', 'expense', 'expenses', 'vat', 'btw', 'loan', 'insurance',
    'factuur', 'facturen', 'betaling', 'betalen', 'belasting', 'boekhouder', 'geld', 'lening', 'verzekering', 'facture', 'factures', 'paiement', 'payer', 'impôts', 'impots', 'comptable', 'argent', 'assurance',
  ],
  Health: [
    'doctor', 'dentist', 'gym', 'pharmacy', 'medicine', 'medication', 'workout', 'run', 'health', 'hospital', 'appointment with the doctor', 'sport', 'vitamins',
    'dokter', 'tandarts', 'apotheek', 'medicijnen', 'fitness', 'ziekenhuis', 'gezondheid', 'médecin', 'medecin', 'dentiste', 'pharmacie', 'médicament', 'medicament', 'hôpital', 'hopital', 'santé', 'sante',
  ],
  Travel: [
    'flight', 'hotel', 'trip', 'travel', 'airport', 'train', 'ticket', 'passport', 'vacation', 'holiday', 'booking',
    'vlucht', 'reis', 'vakantie', 'luchthaven', 'trein', 'paspoort', 'vol', 'voyage', 'aéroport', 'aeroport', 'vacances', 'billet', 'passeport',
  ],
  Personal: [
    'wife', 'husband', 'kids', 'children', 'family', 'home', 'house', 'birthday', 'mom', 'dad', 'mother', 'father', 'friend', 'dinner', 'weekend',
    'vrouw', 'man', 'kinderen', 'familie', 'thuis', 'huis', 'verjaardag', 'mama', 'papa', 'vriend', 'vriendin', 'femme', 'mari', 'enfants', 'famille', 'maison', 'anniversaire', 'maman', 'papa', 'ami', 'amie',
  ],
};

export interface Classification {
  category: string;
  confidence: number;
  tags: string[];
}

export function classifyText(text: string, opts: { isIdea?: boolean; people?: string[] } = {}): Classification {
  const tokens = new Set(tokenize(text));
  const lower = text.toLowerCase();
  const scores = new Map<string, number>();
  for (const [category, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const word of words) {
      if (word.includes(' ') || word.includes('.')) {
        if (lower.includes(word)) score += 2;
      } else if (tokens.has(word)) {
        score += 1;
      }
    }
    if (score > 0) scores.set(category, score);
  }
  let best: string = opts.isIdea ? 'Ideas' : 'Uncategorized';
  let bestScore = 0;
  for (const [category, score] of scores) {
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  if (bestScore === 0 && (opts.people?.length ?? 0) > 0 && !opts.isIdea) best = 'People';
  const confidence = bestScore === 0 ? 0.4 : Math.min(0.95, 0.6 + bestScore * 0.1);
  const tags = Array.from(scores.keys())
    .filter((c) => c !== best)
    .map((c) => c.toLowerCase())
    .slice(0, 3);
  if (opts.isIdea) tags.unshift('idea');
  return { category: best, confidence, tags: Array.from(new Set(tags)) };
}

const TITLE_STOP: Record<Language, RegExp> = {
  en: /^(?:that|the fact that|i think|i believe|maybe|about|of)\s+/i,
  nl: /^(?:dat|het feit dat|ik denk dat|misschien|over|van)\s+/i,
  fr: /^(?:que|qu'|le fait que|je pense que|peut-être|sur|de)\s+/i,
};

/** Suggests a short title from a note/idea body: first clause, max ~60 chars. */
export function suggestTitle(content: string, language: Language): string {
  let text = content.trim().replace(/\s+/g, ' ');
  text = text.replace(TITLE_STOP[language], '');
  const firstClause = text.split(/[.!?;:]\s|\s[-–—]\s/)[0] ?? text;
  const cut = truncate(firstClause, 60);
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

const PRIORITY_WORDS: Record<Language, { urgent: string[]; high: string[]; low: string[] }> = {
  en: { urgent: ['urgent', 'asap', 'immediately', 'right away', 'critical'], high: ['important', 'priority', 'must'], low: ['someday', 'eventually', 'low priority', 'when i have time', 'maybe'] },
  nl: { urgent: ['dringend', 'urgent', 'asap', 'onmiddellijk', 'meteen', 'zo snel mogelijk'], high: ['belangrijk', 'prioriteit', 'zeker'], low: ['ooit', 'eventueel', 'als ik tijd heb', 'misschien', 'lage prioriteit'] },
  fr: { urgent: ['urgent', 'urgente', 'asap', 'immédiatement', 'immediatement', 'tout de suite'], high: ['important', 'importante', 'priorité', 'priorite'], low: ['un jour', 'éventuellement', 'eventuellement', 'quand j\'ai le temps', 'peut-être', 'basse priorité'] },
};

export function detectPriority(text: string, language: Language): { priority: 'low' | 'normal' | 'high' | 'urgent'; matched: string | null } {
  const lower = text.toLowerCase();
  const words = PRIORITY_WORDS[language];
  for (const w of words.urgent) if (lower.includes(w)) return { priority: 'urgent', matched: w };
  for (const w of words.high) if (lower.includes(w)) return { priority: 'high', matched: w };
  for (const w of words.low) if (lower.includes(w)) return { priority: 'low', matched: w };
  return { priority: 'normal', matched: null };
}
