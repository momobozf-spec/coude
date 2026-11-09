import type { DateTime } from 'luxon';
import { z } from 'zod';

import { dateResolver, type ResolveContext } from '../date/DateResolver';
import type { Language } from '../types/common';
import { capitalizeFirst, collapseWhitespace, trimPunctuation } from '../util/text';

/**
 * Meeting notes → proposals (§121, §123). Deterministic rules for structured notes
 * ("Beslist: …", "Actie (Sven): …", "Risico: …") and for spoken debriefs ("Hij gaat de
 * toegang regelen. Ik moet tegen vrijdag de dashboardaanpassing doen."). The LLM
 * extractor returns the same shape (dates as phrases, resolved locally).
 */

export const MeetingExtractionSchema = z.object({
  summary: z.string().nullable(),
  decisions: z.array(z.object({ decision: z.string(), reason: z.string().nullable() })).max(20),
  tasks: z.array(z.object({ title: z.string(), owner: z.string().nullable(), isMine: z.boolean(), duePhrase: z.string().nullable() })).max(30),
  followUps: z.array(z.object({ who: z.string(), what: z.string(), expectedPhrase: z.string().nullable() })).max(20),
  risks: z.array(z.object({ description: z.string(), impact: z.enum(['low', 'medium', 'high']).nullable() })).max(10),
  questions: z.array(z.string()).max(20),
  participants: z.array(z.string()).max(20),
});
export type MeetingExtraction = z.infer<typeof MeetingExtractionSchema>;

export interface ResolvedProposal {
  kind: 'task' | 'decision' | 'follow_up' | 'risk' | 'question';
  title: string;
  payload: Record<string, unknown>;
}

export interface ExtractContext {
  language: Language;
  now: DateTime;
  timezone: string;
  /** How the user refers to themself in notes ("ik", "I", "me"); first names of the user. */
  selfNames?: string[];
}

const EMPTY: MeetingExtraction = { summary: null, decisions: [], tasks: [], followUps: [], risks: [], questions: [], participants: [] };

const SELF: Record<Language, RegExp> = { en: /^(?:i|me|myself|mine)$/i, nl: /^(?:ik|mij|me|mezelf|ikzelf)$/i, fr: /^(?:je|moi|moi-même)$/i };
const THIRD: Record<Language, RegExp> = { en: /^(?:he|she|they)$/i, nl: /^(?:hij|zij|ze)$/i, fr: /^(?:il|elle|ils|elles)$/i };

const LINE_RULES: Record<Language, { kind: ResolvedProposal['kind']; re: RegExp }[]> = {
  en: [
    { kind: 'decision', re: /^(?:decision|decided|agreed|we decided(?: to)?|we agreed(?: to)?)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'risk', re: /^(?:risk|risks|concern)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'follow_up', re: /^(?:waiting for|waiting on|follow[- ]?up|pending from)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'question', re: /^(?:open question|question|tbd|to be decided)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'task', re: /^(?:action|action item|todo|to do|task|ai)\s*(?:\((?<owner>[^)]+)\)|@(?<owner2>\S+))?\s*[:\-–]?\s*(?<text>.+)$/i },
  ],
  nl: [
    { kind: 'decision', re: /^(?:beslist|beslissing|besloten|afgesproken|we hebben beslist(?: om)?|we hebben afgesproken(?: om)?)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'risk', re: /^(?:risico|risico's|bezorgdheid|aandachtspunt)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'follow_up', re: /^(?:wacht op|wachten op|opvolgen|follow[- ]?up|nog te ontvangen van)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'question', re: /^(?:open vraag|vraag|nog te beslissen|te bepalen)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'task', re: /^(?:actie|actiepunt|todo|to do|taak|te doen)\s*(?:\((?<owner>[^)]+)\)|@(?<owner2>\S+))?\s*[:\-–]?\s*(?<text>.+)$/i },
  ],
  fr: [
    { kind: 'decision', re: /^(?:décision|decision|décidé|decide|convenu|nous avons décidé(?: de)?)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'risk', re: /^(?:risque|risques|point d'attention)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'follow_up', re: /^(?:en attente de|attente|suivi|à suivre)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'question', re: /^(?:question ouverte|question|à décider|a decider)\s*[:\-–]?\s*(?<text>.+)$/i },
    { kind: 'task', re: /^(?:action|tâche|tache|todo|à faire|a faire)\s*(?:\((?<owner>[^)]+)\)|@(?<owner2>\S+))?\s*[:\-–]?\s*(?<text>.+)$/i },
  ],
};

/** "X gaat Y regelen", "X will Y", "X va Y" and "ik moet (tegen D) Y". */
const SENTENCE_RULES: Record<Language, { kind: 'promise' | 'mine'; re: RegExp }[]> = {
  en: [
    { kind: 'mine', re: /^(?:i|we)\s+(?:need to|have to|must|should|will|'ll|am going to|are going to)\s+(?<text>.+)$/i },
    { kind: 'promise', re: /^(?<who>[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?|he|she|they)\s+(?:will|'ll|is going to|are going to|promised to|said (?:he|she|they) would|takes care of|will take care of)\s+(?<text>.+)$/iu },
  ],
  nl: [
    { kind: 'mine', re: /^(?:ik|we|wij)\s+(?:moet|moeten|zal|zullen|ga|gaan)\s+(?<text>.+)$/i },
    { kind: 'promise', re: /^(?<who>[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?|hij|zij|ze)\s+(?:gaat|zal|zou|regelt|bezorgt|stuurt|neemt|zorgt voor|belooft)\s+(?<text>.+)$/iu },
  ],
  fr: [
    { kind: 'mine', re: /^(?:je|nous)\s+(?:dois|devons|vais|allons|ferai|ferons)\s+(?<text>.+)$/i },
    { kind: 'promise', re: /^(?<who>[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?|il|elle|ils|elles)\s+(?:va|vont|s'occupe de|s'occupera de|enverra|promet de|fera)\s+(?<text>.+)$/iu },
  ],
};

const MEETING_DONE: Record<Language, RegExp> = {
  en: /^(?:the\s+)?(?:meeting|call|chat|conversation)\s+with\s+(?<who>[A-Z][\p{L}'-]+(?:\s+(?:and|&)\s+[A-Z][\p{L}'-]+)*)\s+(?:is|was)\s+(?:done|over|finished|completed)/iu,
  nl: /^(?:de\s+)?(?:meeting|vergadering|overleg|call|gesprek|afspraak)\s+met\s+(?<who>[A-Z][\p{L}'-]+(?:\s+(?:en|&)\s+[A-Z][\p{L}'-]+)*)\s+(?:is|was)\s+(?:gedaan|klaar|afgelopen|voorbij|achter de rug|afgerond)/iu,
  fr: /^(?:la\s+)?(?:réunion|reunion|rencontre|call|appel|entretien)\s+avec\s+(?<who>[A-Z][\p{L}'-]+(?:\s+(?:et|&)\s+[A-Z][\p{L}'-]+)*)\s+(?:est|était)\s+(?:terminée?|finie?|faite?)/iu,
};

const TRAILING_VERB_NL = /^(.*?)\s+(regelen|doen|sturen|bezorgen|nakijken|afwerken|opvolgen|maken|voorzien|aanleveren|controleren|bekijken|afronden|opleveren|klaarzetten)\s*$/i;

function rc(ctx: ExtractContext): ResolveContext {
  return { now: ctx.now, timezone: ctx.timezone, language: ctx.language, timePolicy: 'business', preferFuture: true };
}

function cleanTitle(text: string, language: Language): string {
  let t = collapseWhitespace(trimPunctuation(text));
  if (language === 'nl') {
    const m = TRAILING_VERB_NL.exec(t);
    if (m && m[1] && m[2]) t = `${m[1].replace(/^(?:de|het|een)\s+/i, '')} ${m[2].toLowerCase()}`;
    t = t.replace(/^(?:om\s+)?(?:te\s+)?/i, '');
  }
  return capitalizeFirst(t);
}

function splitDue(text: string, ctx: ExtractContext): { text: string; duePhrase: string | null; dueDate: string | null } {
  const ex = dateResolver.extract(text, rc(ctx));
  if (!ex.resolution?.date) return { text, duePhrase: null, dueDate: null };
  const remaining = ex.remainingText.replace(/\b(?:tegen|voor|by|before|pour|avant|d'ici)\s*$/i, '').replace(/^\s*(?:tegen|voor|by|before|pour|avant|d'ici)\b/i, '');
  return { text: collapseWhitespace(remaining), duePhrase: ex.resolution.matchedText.join(' '), dueDate: ex.resolution.date };
}

function isSelf(who: string, ctx: ExtractContext): boolean {
  return SELF[ctx.language].test(who) || (ctx.selfNames ?? []).some((n) => n.toLowerCase() === who.toLowerCase());
}

/** Structured notes: one proposal per recognised line; free lines are ignored (the LLM covers those). */
export function extractFromNotes(notes: string, ctx: ExtractContext): MeetingExtraction {
  const out: MeetingExtraction = { ...EMPTY, decisions: [], tasks: [], followUps: [], risks: [], questions: [], participants: [] };
  const lines = notes
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/^[\s*\-•·\d.)]+/, '').trim())
    .filter(Boolean);
  for (const line of lines) {
    let matched = false;
    for (const rule of LINE_RULES[ctx.language]) {
      const m = rule.re.exec(line);
      if (!m?.groups?.text) continue;
      matched = true;
      const text = m.groups.text.trim();
      const owner = m.groups.owner ?? m.groups.owner2 ?? null;
      switch (rule.kind) {
        case 'decision': {
          const reason = /\b(?:because|omdat|want|parce que|car)\b\s+(.+)$/i.exec(text);
          out.decisions.push({ decision: reason ? text.slice(0, reason.index).trim() : text, reason: reason?.[1]?.trim() ?? null });
          break;
        }
        case 'risk':
          out.risks.push({ description: text, impact: /\b(high|hoog|élevé|eleve|critical)\b/i.test(text) ? 'high' : /\b(low|laag|faible)\b/i.test(text) ? 'low' : null });
          break;
        case 'follow_up': {
          const who = /^(?<who>[A-Z][\p{L}'-]+)\s*[:\-–]?\s*(?<what>.+)$/u.exec(text);
          const { text: what, duePhrase } = splitDue(who?.groups?.what ?? text, ctx);
          out.followUps.push({ who: who?.groups?.who ?? owner ?? '?', what: cleanTitle(what, ctx.language), expectedPhrase: duePhrase });
          break;
        }
        case 'question':
          out.questions.push(text);
          break;
        case 'task': {
          const { text: title, duePhrase } = splitDue(text, ctx);
          const mine = !owner || isSelf(owner, ctx);
          out.tasks.push({ title: cleanTitle(title, ctx.language), owner: mine ? null : owner, isMine: mine, duePhrase });
          break;
        }
        default:
          break;
      }
    }
    if (!matched && line.endsWith('?')) out.questions.push(line);
  }
  return out;
}

/** Spoken debrief ("Meeting met Sven is gedaan. Hij gaat de toegang regelen. Ik moet tegen vrijdag …"). */
export function extractFromSpeech(text: string, ctx: ExtractContext): MeetingExtraction & { meetingWith: string[] } {
  const out: MeetingExtraction & { meetingWith: string[] } = { ...EMPTY, decisions: [], tasks: [], followUps: [], risks: [], questions: [], participants: [], meetingWith: [] };
  const sentences = text
    .replace(/\r/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => trimPunctuation(s.trim()))
    .filter(Boolean);
  let lastPerson: string | null = null;
  for (const sentence of sentences) {
    const done = MEETING_DONE[ctx.language].exec(sentence);
    if (done?.groups?.who) {
      const people = done.groups.who.split(/\s+(?:and|en|et|&)\s+/i);
      out.meetingWith.push(...people);
      out.participants.push(...people);
      lastPerson = people[0] ?? null;
      continue;
    }
    let handled = false;
    for (const rule of SENTENCE_RULES[ctx.language]) {
      const m = rule.re.exec(sentence);
      if (!m?.groups?.text) continue;
      handled = true;
      const { text: body, duePhrase } = splitDue(m.groups.text, ctx);
      if (rule.kind === 'mine') {
        out.tasks.push({ title: cleanTitle(body, ctx.language), owner: null, isMine: true, duePhrase });
      } else {
        const rawWho = m.groups.who ?? '';
        const who = THIRD[ctx.language].test(rawWho) ? (lastPerson ?? rawWho) : rawWho;
        if (!THIRD[ctx.language].test(rawWho)) lastPerson = rawWho;
        out.followUps.push({ who, what: cleanTitle(body, ctx.language), expectedPhrase: duePhrase });
      }
      break;
    }
    if (handled) continue;
    const decided = /\b(?:we hebben beslist|we hebben afgesproken|beslist dat|afgesproken dat|we decided|we agreed|decided that|nous avons décidé|on a décidé)\b\s*(?:om\s+|to\s+|de\s+|dat\s+|that\s+|que\s+)?(?<text>.+)$/i.exec(sentence);
    if (decided?.groups?.text) {
      out.decisions.push({ decision: capitalizeFirst(decided.groups.text), reason: null });
      continue;
    }
    const risk = /\b(?:kan|kunnen|could|might|may|risque de|pourrait)\b[^.]*\b(?:blokkeren|vertragen|block|delay|bloquer|retarder)\b/i.exec(sentence);
    if (risk) out.risks.push({ description: capitalizeFirst(sentence), impact: null });
    else if (sentence.endsWith('?')) out.questions.push(sentence);
  }
  return out;
}

/** Turns an extraction (deterministic or LLM) into storable proposals with locally resolved dates. */
export function toProposals(extraction: MeetingExtraction, ctx: ExtractContext): ResolvedProposal[] {
  const proposals: ResolvedProposal[] = [];
  const resolve = (phrase: string | null): string | null => (phrase ? (dateResolver.resolve(phrase, rc(ctx))?.date ?? null) : null);
  for (const d of extraction.decisions) proposals.push({ kind: 'decision', title: d.decision, payload: { reason: d.reason } });
  for (const t of extraction.tasks) proposals.push({ kind: 'task', title: t.title, payload: { owner: t.owner, isMine: t.isMine, dueDate: resolve(t.duePhrase), duePhrase: t.duePhrase } });
  for (const f of extraction.followUps) proposals.push({ kind: 'follow_up', title: f.what, payload: { who: f.who, expectedDate: resolve(f.expectedPhrase), expectedPhrase: f.expectedPhrase } });
  for (const r of extraction.risks) proposals.push({ kind: 'risk', title: r.description, payload: { impact: r.impact ?? 'medium' } });
  for (const q of extraction.questions) proposals.push({ kind: 'question', title: q, payload: {} });
  return proposals;
}
