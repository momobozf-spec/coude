import { z } from 'zod';

import type { CommunicationStyle } from '../domain/admin';
import type { Language } from '../types/common';
import { capitalizeFirst, collapseWhitespace, trimPunctuation } from '../util/text';

/**
 * Deterministic reply drafting (§96–§97) used when cloud AI is off or unavailable, and
 * the shared style tables used by the LLM prompts. The deterministic path turns the
 * user's instruction ("dat ik dit morgen bekijk") into a first-person sentence and wraps
 * it in a greeting and closing that match the chosen style.
 */

export const DraftOutputSchema = z.object({ subject: z.string(), body: z.string() });
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

interface StyleTemplate {
  greeting: string;
  closing: string;
}

const TEMPLATES: Record<Language, Record<CommunicationStyle, StyleTemplate>> = {
  nl: {
    professional: { greeting: 'Beste {name},', closing: 'Met vriendelijke groeten,' },
    professional_friendly: { greeting: 'Beste {name},', closing: 'Vriendelijke groeten,' },
    professional_clear: { greeting: 'Beste {name},', closing: 'Met vriendelijke groeten,' },
    professional_direct: { greeting: 'Beste {name},', closing: 'Met vriendelijke groeten,' },
    friendly: { greeting: 'Hallo {name},', closing: 'Hartelijke groeten,' },
    concise: { greeting: 'Beste {name},', closing: 'Groeten,' },
    direct: { greeting: 'Beste {name},', closing: 'Groeten,' },
    formal: { greeting: 'Geachte {name},', closing: 'Met vriendelijke groeten,' },
    informal: { greeting: 'Hoi {name},', closing: 'Groeten,' },
    informal_short: { greeting: 'Hoi {name},', closing: 'Groeten,' },
  },
  en: {
    professional: { greeting: 'Dear {name},', closing: 'Best regards,' },
    professional_friendly: { greeting: 'Hello {name},', closing: 'Kind regards,' },
    professional_clear: { greeting: 'Dear {name},', closing: 'Best regards,' },
    professional_direct: { greeting: 'Hello {name},', closing: 'Regards,' },
    friendly: { greeting: 'Hi {name},', closing: 'Warm regards,' },
    concise: { greeting: 'Hello {name},', closing: 'Regards,' },
    direct: { greeting: 'Hello {name},', closing: 'Regards,' },
    formal: { greeting: 'Dear {name},', closing: 'Yours sincerely,' },
    informal: { greeting: 'Hi {name},', closing: 'Cheers,' },
    informal_short: { greeting: 'Hi {name},', closing: 'Thanks,' },
  },
  fr: {
    professional: { greeting: 'Bonjour {name},', closing: 'Bien à vous,' },
    professional_friendly: { greeting: 'Bonjour {name},', closing: 'Bien cordialement,' },
    professional_clear: { greeting: 'Bonjour {name},', closing: 'Cordialement,' },
    professional_direct: { greeting: 'Bonjour {name},', closing: 'Cordialement,' },
    friendly: { greeting: 'Bonjour {name},', closing: 'Bien à vous,' },
    concise: { greeting: 'Bonjour {name},', closing: 'Cordialement,' },
    direct: { greeting: 'Bonjour {name},', closing: 'Cordialement,' },
    formal: { greeting: 'Madame, Monsieur,', closing: 'Je vous prie d’agréer mes salutations distinguées,' },
    informal: { greeting: 'Salut {name},', closing: 'À bientôt,' },
    informal_short: { greeting: 'Salut {name},', closing: 'À plus,' },
  },
};

const THANKS: Record<Language, string> = { nl: 'Bedankt voor je bericht.', en: 'Thank you for your message.', fr: 'Merci pour votre message.' };
const ACKNOWLEDGE: Record<Language, string> = { nl: 'Ik bekijk je vraag en kom er zo snel mogelijk bij je op terug.', en: 'I will look into your question and get back to you as soon as possible.', fr: 'Je regarde votre demande et je reviens vers vous dès que possible.' };
const FRIENDLY_EXTRA: Record<Language, string> = { nl: 'Alvast bedankt!', en: 'Thanks in advance!', fr: 'Merci d’avance !' };

const NL_AUX = new Set(['heb', 'hebt', 'heeft', 'hebben', 'ben', 'bent', 'is', 'zijn', 'was', 'waren', 'had', 'hadden', 'kan', 'kunnen', 'zal', 'zullen', 'wil', 'willen', 'moet', 'moeten', 'mag', 'mogen', 'ga', 'gaat', 'gaan', 'word', 'wordt', 'worden', 'zou', 'zouden']);

/**
 * "dat ik dit morgen bekijk" → "Ik bekijk dit morgen."
 * "dat ik de factuur nog niet via Peppol heb ontvangen" → "Ik heb de factuur nog niet via Peppol ontvangen."
 * "that I'll look at this tomorrow" → "I'll look at this tomorrow."
 * "of hij dit kan nakijken" → "Kun je dit nakijken?"
 */
export function instructionToSentence(instruction: string, language: Language): string {
  let text = collapseWhitespace(trimPunctuation(instruction));
  if (!text) return '';
  const lower = text.toLowerCase();
  if (language === 'nl') {
    const ask = /^(?:of|dat)\s+(?:hij|zij|ze|je|u|jullie)\s+(.+)$/i.exec(text);
    if (ask && ask[1]) {
      const words = ask[1].split(' ');
      const verbIdx = words.findIndex((w) => /^(?:kan|kunt|kunnen|wil|wilt|willen|zou|zouden)$/i.test(w));
      if (verbIdx >= 0) {
        const rest = [...words.slice(0, verbIdx), ...words.slice(verbIdx + 1)].join(' ');
        return `${capitalizeFirst(/^(?:zou|zouden)$/i.test(words[verbIdx] ?? '') ? 'zou je' : /^(?:wil|wilt|willen)$/i.test(words[verbIdx] ?? '') ? 'wil je' : 'kun je')} ${rest}?`;
      }
      return `${capitalizeFirst(ask[1])}?`;
    }
    const me = /^(?:dat\s+)?(?:ik|we|wij)\s+(.+)$/i.exec(text);
    if (me && me[1]) {
      const subject = /^(?:dat\s+)?(we|wij)\b/i.test(lower) ? 'We' : 'Ik';
      const words = me[1].split(' ');
      if (words.length >= 2 && NL_AUX.has((words[words.length - 2] ?? '').toLowerCase())) {
        const finite = words[words.length - 2] ?? '';
        const participle = words[words.length - 1] ?? '';
        const rest = words.slice(0, -2).join(' ');
        return `${subject} ${finite}${rest ? ` ${rest}` : ''} ${participle}.`;
      }
      const finite = words[words.length - 1] ?? '';
      const rest = words.slice(0, -1).join(' ');
      return `${subject} ${finite}${rest ? ` ${rest}` : ''}.`;
    }
    return `${capitalizeFirst(text)}.`;
  }
  if (language === 'en') {
    const ask = /^(?:if|whether)\s+(?:he|she|they|you)\s+(?:can|could|would)\s+(.+)$/i.exec(text);
    if (ask && ask[1]) return `Could you ${ask[1]}?`;
    text = text.replace(/^that\s+/i, '');
    return `${capitalizeFirst(text)}.`;
  }
  const askFr = /^(?:si|s')\s*(?:il|elle|ils|vous|tu)\s+(?:peut|peux|pouvez|pourrait|pourriez)\s+(.+)$/i.exec(text);
  if (askFr && askFr[1]) return `Pourriez-vous ${askFr[1]} ?`;
  text = text.replace(/^(?:que|qu')\s*/i, '');
  return `${capitalizeFirst(text)}.`;
}

export interface DeterministicDraftInput {
  recipientName: string | null;
  instruction: string;
  style: CommunicationStyle;
  language: Language;
  signature: string | null;
  /** Previous body core when refining, so the sentences are kept. */
  previousCore?: string | null;
  /**
   * The instruction is a guideline on HOW to answer (Alfred's own default), not content the user
   * dictated. Without an LLM it must never be echoed into the mail: a neutral acknowledgement is
   * drafted instead, which the user still reviews on the approval card.
   */
  guideline?: boolean;
}

export function composeDraftBody(input: DeterministicDraftInput): { body: string; core: string } {
  const t = TEMPLATES[input.language][input.style];
  const name = input.recipientName?.split(' ')[0] ?? '';
  const greeting = name ? t.greeting.replace('{name}', name) : t.greeting.replace(' {name}', '').replace('{name}', '');
  const sentence = input.guideline ? ACKNOWLEDGE[input.language] : input.instruction ? instructionToSentence(input.instruction, input.language) : '';
  const core = [input.previousCore, sentence].filter((s): s is string => Boolean(s && s.trim())).join('\n');
  const parts: string[] = [greeting, ''];
  if (!input.previousCore && input.style !== 'informal_short' && input.style !== 'concise' && input.style !== 'direct') parts.push(THANKS[input.language], '');
  parts.push(core || '…', '');
  if (input.style === 'professional_friendly' || input.style === 'friendly') parts.push(FRIENDLY_EXTRA[input.language], '');
  parts.push(t.closing);
  if (input.signature) parts.push(input.signature);
  return { body: parts.join('\n'), core };
}

/** Style implied by a refinement instruction ("maak het professioneler", "shorter", "plus formel"). */
export function styleFromInstruction(instruction: string, current: CommunicationStyle): { style: CommunicationStyle; matched: boolean } {
  const lower = instruction.toLowerCase();
  if (/\b(formeler|formal|formel|formelle|plus formel)\b/.test(lower)) return { style: 'formal', matched: true };
  if (/\b(professione+ler|professional|professionnel|zakelijker|more professional|plus professionnel)\b/.test(lower)) return { style: 'professional', matched: true };
  if (/\b(vriendelijker|friendlier|more friendly|warmer|plus amical|plus chaleureux|vriendelijk|friendly|amical)\b/.test(lower)) return { style: 'professional_friendly', matched: true };
  if (/\b(korter|shorter|concise|beknopter|plus court|bondiger|kort)\b/.test(lower)) return { style: 'concise', matched: true };
  if (/\b(directer|more direct|direct|plus direct)\b/.test(lower)) return { style: 'direct', matched: true };
  if (/\b(informeler|informal|losser|casual|plus décontracté|decontracte|less formal|minder formeel)\b/.test(lower)) return { style: 'informal', matched: true };
  return { style: current, matched: false };
}

export function styleLabel(style: CommunicationStyle, language: Language): string {
  const labels: Record<Language, Record<CommunicationStyle, string>> = {
    nl: { professional: 'professioneel', professional_friendly: 'professioneel maar vriendelijk', professional_clear: 'professioneel en duidelijk', professional_direct: 'professioneel en direct', friendly: 'vriendelijk', concise: 'beknopt', direct: 'direct', formal: 'formeel', informal: 'informeel', informal_short: 'kort en informeel' },
    en: { professional: 'professional', professional_friendly: 'professional but friendly', professional_clear: 'professional and clear', professional_direct: 'professional and direct', friendly: 'friendly', concise: 'concise', direct: 'direct', formal: 'formal', informal: 'informal', informal_short: 'short and informal' },
    fr: { professional: 'professionnel', professional_friendly: 'professionnel mais amical', professional_clear: 'professionnel et clair', professional_direct: 'professionnel et direct', friendly: 'amical', concise: 'concis', direct: 'direct', formal: 'formel', informal: 'informel', informal_short: 'court et informel' },
  };
  return labels[language][style];
}

/** Keeps the sentences between greeting and closing of a deterministic draft. */
export function extractCore(body: string, language: Language): string {
  const lines = body.split('\n');
  const greetings = Object.values(TEMPLATES[language]).map((t) => t.greeting.replace(' {name},', '').replace('{name}', '').replace(',', '').toLowerCase());
  const closings = Object.values(TEMPLATES[language]).map((t) => t.closing.toLowerCase());
  const extras = [THANKS[language].toLowerCase(), FRIENDLY_EXTRA[language].toLowerCase()];
  const core: string[] = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (!started) {
      if (line === '' || greetings.some((g) => g && lower.startsWith(g))) {
        started = line === '' ? started : true;
        continue;
      }
      started = true;
    }
    if (closings.some((c) => lower === c || lower.startsWith(c.replace(',', '')))) break;
    if (extras.includes(lower) || line === '' || line === '…') continue;
    core.push(line);
  }
  return core.join('\n');
}
