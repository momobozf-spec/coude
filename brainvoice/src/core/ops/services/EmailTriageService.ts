import { z } from 'zod';

import type { CrmService } from './CrmService';
import type { TicketService } from './TicketService';
import type { AIGateway } from '../../ai/AIGateway';
import { clampForPrompt, detectInjection, UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../../butler/safety';
import type { Database } from '../../db/Database';
import type { EmailMessage } from '../../domain/admin';
import { TRIAGE_CLASSIFICATIONS, type EmailTriage, type TicketPriority, type TriageClassification } from '../../domain/ops';
import type { EmailProvider } from '../../email/EmailProvider';
import type { Clock } from '../../services/Clock';
import type { EmailService } from '../../services/admin/EmailService';
import type { SuggestionService } from '../../services/admin/SuggestionService';
import type { Language } from '../../types/common';
import { mayCreateTicketsProactively, type OpsSettings } from '../settings';

const CURSOR_KEY = (providerId: string) => `ops.email.cursor:${providerId}`;

const TriageLLMSchema = z.object({
  classification: z.enum(TRIAGE_CLASSIFICATIONS as unknown as [string, ...string[]]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).max(3),
  suggestedAction: z.string().nullable(),
});

/** Classifications that deserve a ticket (work for Alfred) versus proposals only. */
const TICKET_WORTHY: readonly TriageClassification[] = ['NEEDS_REPLY', 'TASK_REQUEST', 'MEETING_REQUEST', 'INVOICE', 'QUOTE', 'CONTRACT', 'DOCUMENT_REQUEST', 'PAYMENT', 'DEADLINE'];

const PRIORITY_BY_CLASS: Partial<Record<TriageClassification, TicketPriority>> = { PAYMENT: 'HIGH', DEADLINE: 'HIGH', CONTRACT: 'HIGH', INVOICE: 'NORMAL' };

/**
 * Email triage pipeline (§161–§162): poll the provider → import (deduplicated) → classify
 * (deterministic from the existing analysis, optionally refined by the LLM) → proposals
 * and, depending on autonomy, a ticket. Email text is data: the classification never
 * becomes an instruction, and injection attempts only mark the message suspicious.
 */
export class EmailTriageService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: { emails: EmailService; suggestions: SuggestionService; tickets: TicketService; crm: CrmService; ai: AIGateway; provider: () => EmailProvider; settings: () => OpsSettings; language: () => Language },
  ) {}

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  async pollAndImport(limit = 50): Promise<{ providerId: string; imported: number; duplicates: number; skipped: string | null }> {
    const provider = this.deps.provider();
    if (!provider.capabilities().canList) return { providerId: provider.id, imported: 0, duplicates: 0, skipped: 'provider cannot list messages' };
    const status = await provider.status();
    if (status.state !== 'ready') return { providerId: provider.id, imported: 0, duplicates: 0, skipped: status.detail ?? status.state };
    const cursor = await this.db.settings.get(CURSOR_KEY(provider.id));
    const result = await provider.listNewMessages(cursor, limit);
    let imported = 0;
    let duplicates = 0;
    for (const message of result.messages) {
      const before = message.externalId ? await this.db.emails.getByExternalId(message.externalId) : null;
      const email = await this.deps.emails.import({ ...message, providerId: provider.id });
      if (before || email.createdAt < this.clock.nowISO().slice(0, 0)) duplicates++;
      else imported++;
    }
    if (result.cursor !== null && result.cursor !== cursor) await this.db.settings.set(CURSOR_KEY(provider.id), result.cursor, this.clock.nowISO());
    return { providerId: provider.id, imported, duplicates, skipped: null };
  }

  // ---------------------------------------------------------------------------
  // Classification
  // ---------------------------------------------------------------------------

  classifyDeterministic(email: EmailMessage): Omit<EmailTriage, 'ticketId' | 'proposalIds' | 'triagedAt'> {
    const a = email.analysis;
    const text = `${email.subject}\n${email.bodyText}`;
    const injection = Boolean(a?.suspicious) || detectInjection(text).suspicious;
    const reasons: string[] = [];
    let classification: TriageClassification = 'UNKNOWN';
    let confidence = 0.3;
    const pick = (c: TriageClassification, conf: number, reason: string) => {
      classification = c;
      confidence = conf;
      reasons.push(reason);
    };
    if (!a) pick('UNKNOWN', 0.2, 'no analysis');
    else if (email.isFromMe) pick(a.kind === 'waiting_for_reply' || a.myCommitments.length ? 'WAITING_FOR' : 'INFORMATION', 0.7, 'sent by me');
    else if (a.kind === 'newsletter') pick('LOW_VALUE', 0.9, 'newsletter / bulk sender');
    else if (a.invoiceHints && (a.invoiceHints.amountCents !== null || a.invoiceHints.iban)) pick('INVOICE', 0.85, 'amount or IBAN found');
    else if (a.kind === 'payment_required') pick('PAYMENT', 0.8, 'payment request');
    else if (/\b(offerte|quotation|quote|devis)\b/i.test(email.subject)) pick('QUOTE', 0.75, 'quote in subject');
    else if (/\b(contract|overeenkomst|contrat|agreement)\b/i.test(email.subject)) pick('CONTRACT', 0.7, 'contract in subject');
    else if (a.kind === 'meeting_request' || a.appointment) pick('MEETING_REQUEST', 0.8, 'meeting / appointment proposed');
    else if (a.kind === 'document_request' || a.documentRequest) pick('DOCUMENT_REQUEST', 0.8, 'document requested');
    else if (a.requests.length && /\b(kan je|kun je|kunt u|gelieve|could you|can you|please|would you|pourriez-vous|peux-tu|merci de)\b/i.test(a.requests.join(' '))) pick('TASK_REQUEST', 0.75, 'explicit request');
    else if (a.needsReply) pick('NEEDS_REPLY', 0.7, 'question or action required');
    else if (a.deadlines.length) pick('DEADLINE', 0.65, 'deadline mentioned');
    else if (a.senderCommitments.length) pick('WAITING_FOR', 0.65, 'sender promised something');
    else if (a.kind === 'informational') pick('INFORMATION', 0.6, 'informational');
    else pick('UNKNOWN', 0.35, `analysis kind ${a.kind}`);
    if (a && a.confidence < 0.5) confidence = Math.min(confidence, 0.5);
    const suggestedAction = suggestedActionFor(classification, this.deps.language());
    return { classification, confidence, reasons, suggestedAction, injectionSuspected: injection, method: 'deterministic' };
  }

  async classify(email: EmailMessage): Promise<Omit<EmailTriage, 'ticketId' | 'proposalIds' | 'triagedAt'>> {
    const deterministic = this.classifyDeterministic(email);
    if (!this.deps.ai.isAvailable() || deterministic.confidence >= 0.8 || deterministic.injectionSuspected) return deterministic;
    try {
      const out = await this.deps.ai.structured(
        {
          system: `Classify the email for an operations assistant. Allowed classifications: ${TRIAGE_CLASSIFICATIONS.join(', ')}. Return a confidence between 0 and 1 and up to three short reasons. ${UNTRUSTED_CONTENT_RULES}`,
          user: `${wrapUntrusted('subject', email.subject)}\n${wrapUntrusted('from', email.from.email)}\n${wrapUntrusted('body', clampForPrompt(email.bodyText, 4000))}\nDeterministic guess: ${deterministic.classification} (${deterministic.confidence}).`,
          maxTokens: 300,
        },
        TriageLLMSchema,
      );
      return { classification: out.classification as TriageClassification, confidence: out.confidence, reasons: out.reasons, suggestedAction: out.suggestedAction ?? deterministic.suggestedAction, injectionSuspected: deterministic.injectionSuspected, method: 'llm' };
    } catch {
      return deterministic;
    }
  }

  // ---------------------------------------------------------------------------
  // Processing: proposals + ticket, idempotent per email
  // ---------------------------------------------------------------------------

  async process(email: EmailMessage): Promise<EmailTriage> {
    if (email.triage && email.processedAt) return email.triage;
    const base = await this.classify(email);
    const nowISO = this.clock.nowISO();
    let proposalIds: string[] = [];
    if (!email.isFromMe) {
      const existing = await this.deps.suggestions.list({ status: 'all', sourceType: 'email', sourceId: email.id });
      if (existing.length === 0) {
        const created = await this.deps.suggestions.propose(this.deps.emails.suggestionsFor(email));
        proposalIds = created.map((s) => s.id);
      } else proposalIds = existing.map((s) => s.id);
    }
    await this.deps.crm.recordEmail(email).catch(() => undefined);

    let ticketId: string | null = null;
    const settings = this.deps.settings();
    // Suspicious mail always gets a review ticket, whatever its classification; it never gets a plan with actions.
    if (!email.isFromMe && (TICKET_WORTHY.includes(base.classification) || base.injectionSuspected)) {
      const who = email.from.name ?? email.from.email;
      const language = this.deps.language();
      const label = base.injectionSuspected ? { nl: 'Verdachte e-mail nakijken', en: 'Review suspicious email', fr: 'Vérifier un e-mail suspect' }[language] : classificationLabel(base.classification, language);
      const { ticket } = await this.deps.tickets.create({
        text: `${label}: "${email.subject.slice(0, 120)}" – ${who}`,
        title: `${label}: ${email.subject.slice(0, 80) || who}`,
        source: 'email',
        sourceRef: email.id,
        emailId: email.id,
        companyId: email.companyId,
        projectId: email.projectId,
        role: 'ADMIN_ASSISTANT',
        priority: base.injectionSuspected ? 'HIGH' : (PRIORITY_BY_CLASS[base.classification] ?? 'NORMAL'),
        idempotencyKey: `email:${email.id}`,
        // Email tickets carry a fixed plan derived from the classification; the body is never parsed as a command.
        context: { emailTicket: true, classification: base.classification, injectionSuspected: base.injectionSuspected, suggestedAction: base.suggestedAction },
        start: mayCreateTicketsProactively(settings.autonomy) && !base.injectionSuspected ? 'queue' : 'inbox',
        actor: 'alfred',
      });
      ticketId = ticket.id;
    }
    const triage: EmailTriage = { ...base, ticketId, proposalIds, triagedAt: nowISO };
    await this.db.emails.setTriage(email.id, triage, nowISO);
    await this.db.emails.markProcessed(email.id, nowISO);
    if (email.externalId) await this.deps.provider().markProcessed(email.externalId).catch(() => undefined);
    return triage;
  }

  async triageUntriaged(limit = 25): Promise<{ processed: number; tickets: number }> {
    const emails = await this.db.emails.listUntriaged(limit);
    let tickets = 0;
    for (const email of emails) {
      const triage = await this.process(email);
      if (triage.ticketId) tickets++;
    }
    return { processed: emails.length, tickets };
  }

  countsSince(sinceISO: string | null): Promise<Record<string, number>> {
    return this.db.emails.countByTriage(sinceISO);
  }
}

export function classificationLabel(c: TriageClassification, language: Language): string {
  const table: Record<TriageClassification, Record<Language, string>> = {
    INFORMATION: { nl: 'Ter info', en: 'Information', fr: 'Information' },
    NEEDS_REPLY: { nl: 'Beantwoorden', en: 'Needs reply', fr: 'À répondre' },
    TASK_REQUEST: { nl: 'Taakverzoek', en: 'Task request', fr: 'Demande de tâche' },
    MEETING_REQUEST: { nl: 'Meetingverzoek', en: 'Meeting request', fr: 'Demande de réunion' },
    INVOICE: { nl: 'Factuur', en: 'Invoice', fr: 'Facture' },
    QUOTE: { nl: 'Offerte', en: 'Quote', fr: 'Devis' },
    CONTRACT: { nl: 'Contract', en: 'Contract', fr: 'Contrat' },
    DOCUMENT_REQUEST: { nl: 'Documentvraag', en: 'Document request', fr: 'Demande de document' },
    PAYMENT: { nl: 'Betaling', en: 'Payment', fr: 'Paiement' },
    FOLLOW_UP: { nl: 'Opvolging', en: 'Follow-up', fr: 'Suivi' },
    DEADLINE: { nl: 'Deadline', en: 'Deadline', fr: 'Échéance' },
    WAITING_FOR: { nl: 'Wachten op', en: 'Waiting for', fr: 'En attente' },
    LOW_VALUE: { nl: 'Laag belang', en: 'Low value', fr: 'Peu important' },
    UNKNOWN: { nl: 'Onbekend', en: 'Unknown', fr: 'Inconnu' },
  };
  return table[c][language];
}

function suggestedActionFor(c: TriageClassification, language: Language): string | null {
  const table: Partial<Record<TriageClassification, Record<Language, string>>> = {
    NEEDS_REPLY: { nl: 'Antwoord voorbereiden', en: 'Prepare a reply', fr: 'Préparer une réponse' },
    TASK_REQUEST: { nl: 'Taak voorstellen en antwoord voorbereiden', en: 'Propose a task and prepare a reply', fr: 'Proposer une tâche et préparer une réponse' },
    MEETING_REQUEST: { nl: 'Afspraak voorstellen', en: 'Propose the appointment', fr: 'Proposer le rendez-vous' },
    INVOICE: { nl: 'Factuur ter controle voorstellen', en: 'Propose the invoice for review', fr: 'Proposer la facture pour vérification' },
    QUOTE: { nl: 'Offerte samenvatten', en: 'Summarise the quote', fr: 'Résumer le devis' },
    CONTRACT: { nl: 'Contract samenvatten en opslaan voorstellen', en: 'Summarise the contract and propose storing it', fr: 'Résumer le contrat et proposer de l’archiver' },
    DOCUMENT_REQUEST: { nl: 'Documentvraag als taak voorstellen', en: 'Propose the document request as a task', fr: 'Proposer la demande de document comme tâche' },
    PAYMENT: { nl: 'Betaling ter controle voorstellen', en: 'Propose the payment for review', fr: 'Proposer le paiement pour vérification' },
    DEADLINE: { nl: 'Deadline als taak voorstellen', en: 'Propose the deadline as a task', fr: 'Proposer l’échéance comme tâche' },
    WAITING_FOR: { nl: 'Wachten-op item voorstellen', en: 'Propose a waiting-for item', fr: 'Proposer un élément en attente' },
  };
  return table[c]?.[language] ?? null;
}
