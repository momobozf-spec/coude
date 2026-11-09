import type { DateTime } from 'luxon';

import { detectInjection } from '../butler/safety';
import { dateResolver, type ResolveContext } from '../date/DateResolver';
import type { EmailAnalysis, EmailDeadline, EmailKind } from '../domain/admin';
import { extractInvoiceFromText } from '../finance/extraction';
import { parseAmountToCents } from '../finance/money';
import type { Language } from '../types/common';

/**
 * Deterministic email analysis (§95): classification, questions directed at the user,
 * deadlines, commitments, appointments, invoice hints, document requests. Works
 * offline; the LLM analysis (EmailService) refines it when available. Never produces
 * actions – only facts the user can act on.
 */

export interface AnalyzeInput {
  subject: string;
  bodyText: string;
  isFromMe: boolean;
  fromEmail: string;
  language: Language;
  now: DateTime;
  timezone: string;
}

const NEWSLETTER = /\b(unsubscribe|uitschrijven|afmelden|se désabonner|desabonner|newsletter|nieuwsbrief|no-?reply|noreply|do not reply|niet beantwoorden)\b/i;
const URGENT = /\b(urgent|dringend|asap|zo snel mogelijk|as soon as possible|immediately|onmiddellijk|right away|deadline today|vandaag nog|aujourd'hui impérativement|de toute urgence)\b/i;
const INVOICE = /\b(factuur|facturen|invoice|invoices|facture|factures|betaling|payment|te betalen|amount due|overschrijving|herinnering betaling|payment reminder|rappel de paiement|iban)\b/i;
const DOCUMENT_REQUEST = /\b(ondertekend(?:e)?|getekend(?:e)?|signed|signé(?:e)?|signe)\b[^.?!\n]{0,60}\b(document|contract|overeenkomst|formulier|form|agreement|contrat|bijlage|attachment|exemplaar|copy|kopie)\b|\b(document|contract|overeenkomst|formulier|form|agreement|contrat|bijlage|attachment|kopie|copy|attest|certificaat|certificate)\b[^.?!\n]{0,60}\b(bezorgen|doorsturen|opsturen|sturen|terugsturen|send|return|provide|forward|envoyer|renvoyer|transmettre|fournir)\b|\b(bezorgen|doorsturen|opsturen|terugsturen|send us|send me|return|provide|envoyez|renvoyer|transmettre)\b[^.?!\n]{0,60}\b(document|contract|overeenkomst|formulier|form|agreement|contrat|bijlage|attachment|kopie|copy|attest|certificaat|certificate)\b/i;
const MEETING = /\b(meeting|vergadering|afspraak|overleg|call|gesprek|interview|rendez-?vous|réunion|reunion|entretien|bespreking|kennismaking)\b/i;
const AVAILABILITY = /\b(beschikbaar|beschikbaarheid|available|availability|disponible|disponibilité|disponibilites|wanneer past|when would|when are you|schikt|convient|past het)\b/i;

const QUESTION_CUE: Record<Language, RegExp> = {
  en: /\b(can|could|would|will|do|does|did|are|is|have|has|should|may|what|when|where|which|who|how|why)\b[^?]{0,120}\?/i,
  nl: /\b(kun|kunt|kan|zou|zouden|wil|wilt|heb|hebt|heeft|ben|bent|is|zijn|moet|mag|wat|wanneer|waar|welke|wie|hoe|waarom|lukt|past|schikt)\b[^?]{0,120}\?/i,
  fr: /\b(peux|pouvez|pourriez|pourrais|veux|voulez|as|avez|es|êtes|est|sont|faut|dois|devez|quel|quelle|quand|où|ou|qui|comment|pourquoi|est-ce)\b[^?]{0,120}\?/i,
};
const REQUEST_CUE: Record<Language, RegExp> = {
  en: /\b(please|kindly|could you|can you|would you|we need you to|i need you to|let me know|let us know|get back to|confirm|send (?:me|us)|share|provide|forward)\b/i,
  nl: /\b(gelieve|graag|kun je|kunt u|kan je|zou je|zou u|wil je|wilt u|laat (?:me|mij|ons) weten|bevestig|bezorg|stuur|deel|aub|a\.u\.b\.|alvast bedankt)\b/i,
  fr: /\b(merci de|veuillez|pourriez-vous|pouvez-vous|peux-tu|pourrais-tu|faites-moi savoir|tenez-moi au courant|confirmez|envoyez|transmettez|svp|s'il vous plaît|s'il te plaît)\b/i,
};
const DEADLINE_CUE: Record<Language, RegExp> = {
  en: /\b(by|before|until|no later than|deadline(?: is| of)?|due(?: on| by)?|at the latest)\b\s+([^.?!\n]{2,40})/gi,
  nl: /\b(tegen|voor|vóór|uiterlijk|ten laatste|deadline(?: is)?|binnen)\b\s+([^.?!\n]{2,40})/gi,
  fr: /\b(avant|pour|d'ici|au plus tard|jusqu'au|jusqu'à|échéance|delai|délai)\b\s+([^.?!\n]{2,40})/gi,
};
const SENDER_COMMITMENT: Record<Language, RegExp> = {
  en: /\b(i(?:'ll| will| shall| am going to)|we(?:'ll| will| are going to))\s+([^.?!\n]{3,80})/gi,
  nl: /\b(ik (?:zal|ga|stuur|bezorg|laat|kom|bel|mail)|we (?:zullen|gaan|sturen|bezorgen|laten|komen|bellen|mailen)|wij (?:zullen|gaan|sturen|bezorgen))\s+([^.?!\n]{3,80})/gi,
  fr: /\b(je (?:vais|vous enverrai|t'enverrai|reviens|vous recontacte|te recontacte)|nous (?:allons|vous enverrons|reviendrons))\s+([^.?!\n]{3,80})/gi,
};

function stripQuotedReply(body: string): string {
  const lines = body.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^(?:on .{6,80} wrote:|op .{6,80} schreef .{0,40}:|le .{6,80} a écrit\s*:|-{2,}\s*original message\s*-{2,}|-{2,}\s*oorspronkelijk bericht\s*-{2,}|from:\s.+|van:\s.+|de\s?:\s.+@.+)$/i.test(line.trim())) break;
    if (/^--\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function rc(input: AnalyzeInput, preferFuture = true): ResolveContext {
  return { now: input.now, timezone: input.timezone, language: input.language, timePolicy: 'business', preferFuture };
}

export function analyzeEmail(input: AnalyzeInput): EmailAnalysis {
  const body = stripQuotedReply(input.bodyText);
  const text = `${input.subject}\n${body}`;
  const lower = text.toLowerCase();
  const lang = input.language;
  const injection = detectInjection(text);
  const isNewsletter = NEWSLETTER.test(lower) || /no-?reply|newsletter|nieuwsbrief|marketing|notifications?@/i.test(input.fromEmail);

  const questions: string[] = [];
  const requests: string[] = [];
  for (const s of sentences(body)) {
    if (s.endsWith('?') && (QUESTION_CUE[lang].test(s) || s.length < 140)) questions.push(s);
    else if (REQUEST_CUE[lang].test(s)) requests.push(s);
  }

  const deadlines: EmailDeadline[] = [];
  const deadlineRe = new RegExp(DEADLINE_CUE[lang].source, DEADLINE_CUE[lang].flags);
  let m: RegExpExecArray | null;
  while ((m = deadlineRe.exec(body)) !== null && deadlines.length < 5) {
    const phrase = `${m[1]} ${m[2]}`.trim();
    const resolved = dateResolver.extract(m[2] ?? '', rc(input)).resolution;
    if (resolved?.date) deadlines.push({ phrase, date: resolved.date });
  }

  const senderCommitments: string[] = [];
  const myCommitments: string[] = [];
  const commitRe = new RegExp(SENDER_COMMITMENT[lang].source, SENDER_COMMITMENT[lang].flags);
  while ((m = commitRe.exec(body)) !== null && senderCommitments.length + myCommitments.length < 5) {
    const commitment = `${m[1]} ${m[2]}`.trim();
    (input.isFromMe ? myCommitments : senderCommitments).push(commitment);
  }

  let appointment: EmailAnalysis['appointment'] = null;
  if (MEETING.test(lower) || AVAILABILITY.test(lower)) {
    for (const s of sentences(body)) {
      if (!MEETING.test(s) && !AVAILABILITY.test(s)) continue;
      const resolved = dateResolver.extract(s, rc(input)).resolution;
      if (resolved?.date) {
        appointment = { phrase: s.slice(0, 120), date: resolved.date, time: resolved.time };
        break;
      }
    }
    if (!appointment && (MEETING.test(lower) || AVAILABILITY.test(lower))) appointment = { phrase: input.subject || 'meeting', date: null, time: null };
  }

  let invoiceHints: EmailAnalysis['invoiceHints'] = null;
  if (INVOICE.test(lower)) {
    const extracted = extractInvoiceFromText(body);
    const amountMatch = /(?:€|eur|euro)\s?\d[\d .,]*|\d[\d .,]*\s?(?:€|eur|euro)/i.exec(body);
    const amountCents = extracted.totalCents ?? (amountMatch ? (parseAmountToCents(amountMatch[0])?.cents ?? null) : null);
    invoiceHints = { amountCents, dueDate: extracted.dueDate ?? deadlines[0]?.date ?? null, reference: extracted.paymentReference ?? extracted.invoiceNumber, iban: extracted.iban };
  }

  const documentRequest = !input.isFromMe && DOCUMENT_REQUEST.test(text) ? (sentences(body).find((s) => DOCUMENT_REQUEST.test(s)) ?? input.subject) : null;

  let kind: EmailKind;
  const hasAsk = questions.length > 0 || requests.length > 0;
  if (isNewsletter) kind = 'newsletter';
  else if (!input.isFromMe && invoiceHints && (invoiceHints.amountCents !== null || invoiceHints.dueDate !== null || invoiceHints.iban !== null)) kind = 'payment_required';
  else if (documentRequest) kind = 'document_request';
  else if (!input.isFromMe && appointment && (hasAsk || AVAILABILITY.test(lower))) kind = 'meeting_request';
  else if (!input.isFromMe && hasAsk && URGENT.test(lower)) kind = 'urgent_admin';
  else if (!input.isFromMe && hasAsk) kind = 'action_required';
  else if (input.isFromMe && hasAsk) kind = 'waiting_for_reply';
  else kind = 'informational';

  const needsReply = !input.isFromMe && kind !== 'newsletter' && kind !== 'informational' && (hasAsk || kind === 'meeting_request' || kind === 'document_request');
  const summarySource = sentences(body)[0] ?? input.subject;
  const summary = summarySource ? (summarySource.length > 160 ? `${summarySource.slice(0, 157)}…` : summarySource) : null;
  const confidence = isNewsletter ? 0.9 : hasAsk ? 0.75 : 0.6;

  return {
    kind,
    needsReply,
    questions: questions.slice(0, 8),
    deadlines,
    senderCommitments,
    myCommitments,
    appointment,
    invoiceHints,
    documentRequest,
    suspicious: injection.suspicious,
    summary,
    requests: Array.from(new Set([...questions, ...requests])).slice(0, 8),
    confidence,
    method: 'deterministic',
  };
}

export { stripQuotedReply };
