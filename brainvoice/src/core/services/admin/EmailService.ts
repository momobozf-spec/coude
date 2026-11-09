import { z } from 'zod';

import type { CompanyService } from './CompanyService';
import type { AIGateway } from '../../ai/AIGateway';
import { clampForPrompt, UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../../butler/safety';
import { findBestMatch } from '../../commands/matching';
import type { Database } from '../../db/Database';
import type { EmailFilter } from '../../db/repositories/admin/EmailRepositories';
import { EMAIL_KINDS, type Audience, type CommunicationStyle, type Contact, type EmailAddress, type EmailAnalysis, type EmailDraft, type EmailMessage, type Suggestion } from '../../domain/admin';
import { analyzeEmail } from '../../email/classify';
import { composeDraftBody, DraftOutputSchema, extractCore, styleFromInstruction, styleLabel } from '../../email/drafting';
import type { EmailMessageInput } from '../../email/EmailAdapter';
import { detectLanguage } from '../../intent/LanguageDetector';
import { DomainError, type Language } from '../../types/common';
import { contentFingerprint } from '../../util/hash';
import { newId } from '../../util/id';
import { tokenize } from '../../util/text';
import type { Clock } from '../Clock';

const LLMAnalysisSchema = z.object({
  kind: z.enum(EMAIL_KINDS as unknown as [string, ...string[]]),
  needsReply: z.boolean(),
  summary: z.string().nullable(),
  requests: z.array(z.string()).max(8),
  questions: z.array(z.string()).max(8),
  deadlinePhrases: z.array(z.string()).max(5),
  senderCommitments: z.array(z.string()).max(5),
  documentRequest: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const ANALYZE_SYSTEM_PROMPT = `You analyse one email for a personal administrative assistant and answer as JSON.
${UNTRUSTED_CONTENT_RULES}
Classify the email as one of: informational, newsletter, action_required, waiting_for_reply, payment_required, meeting_request, document_request, urgent_admin.
List what the sender asks of the user ("requests"), explicit questions, deadline phrases verbatim (never compute dates), commitments the sender made, and a document request if any. "summary" is one neutral sentence.`;

const DRAFT_SYSTEM_PROMPT = `You write email replies on behalf of the app user, in the user's language, following the user's instruction exactly.
${UNTRUSTED_CONTENT_RULES}
Write a complete, natural reply: greeting, body that says what the user instructed (first person), closing. Keep facts limited to the instruction and the original email. Never promise anything the instruction does not say. Answer as JSON {"subject","body"}.`;

export interface EmailSearchOptions {
  query?: string | null;
  from?: string | null;
  view?: EmailFilter['view'];
  kind?: EmailFilter['kind'];
  limit?: number;
}

export interface EmailBriefing {
  email: EmailMessage;
  thread: EmailMessage[];
  summary: string;
  /** What the sender wants from the user, as short lines. */
  requested: string[];
  contact: Contact | null;
}

/**
 * Email administration (§95–§96, §135): local message store, deterministic + LLM analysis,
 * needs-reply / waiting views, contextual reply drafting with explicit styles, and
 * approval-only suggestions derived from email content.
 */
export class EmailService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly companies: CompanyService,
    private readonly ai: AIGateway,
    private readonly language: () => Language,
    private readonly signature: () => string | null,
  ) {}

  // ---------------------------------------------------------------------------
  // Import & analysis
  // ---------------------------------------------------------------------------

  async import(input: EmailMessageInput): Promise<EmailMessage> {
    if (input.externalId) {
      const existing = await this.db.emails.getByExternalId(input.externalId);
      if (existing) return existing;
    }
    const now = this.clock.nowISO();
    const receivedAt = input.receivedAt ?? now;
    const bodyText = input.bodyText.replace(/\r/g, '');
    // Messages without a stable external id (paste, share sheet) are de-duplicated by content (§162).
    const contentHash = contentFingerprint([input.from.email, input.subject, bodyText, input.receivedAt ?? '']);
    if (!input.externalId) {
      const duplicate = await this.db.emails.getByContentHash(contentHash);
      if (duplicate) return duplicate;
    }
    const analysis = analyzeEmail({ subject: input.subject, bodyText, isFromMe: input.isFromMe ?? false, fromEmail: input.from.email, language: this.languageOf(input.subject, bodyText), now: this.clock.now(), timezone: this.clock.timezone() });
    const contact = input.isFromMe ? (input.to?.[0] ? await this.companies.contactByEmail(input.to[0].email) : null) : await this.companies.contactByEmail(input.from.email);
    const email: EmailMessage = {
      id: newId(),
      externalId: input.externalId ?? null,
      threadId: input.threadId ?? null,
      account: input.account ?? null,
      from: input.from,
      to: input.to ?? [],
      cc: input.cc ?? [],
      subject: input.subject.trim(),
      bodyText,
      snippet: bodyText.replace(/\s+/g, ' ').trim().slice(0, 160),
      receivedAt,
      isFromMe: input.isFromMe ?? false,
      isRead: input.isRead ?? false,
      analysis,
      repliedAt: null,
      handledAt: null,
      contactId: contact?.id ?? null,
      companyId: contact?.companyId ?? null,
      projectId: null,
      archived: false,
      triage: null,
      triagedAt: null,
      processedAt: null,
      contentHash,
      providerId: input.providerId ?? 'local',
      createdAt: now,
      updatedAt: now,
    };
    if (!email.threadId) email.threadId = email.id;
    await this.db.emails.insert(email);
    // A reply from the sender closes the "waiting for reply" state of my earlier mail in the thread.
    if (!email.isFromMe) {
      const thread = await this.db.emails.listThread(email.threadId);
      for (const mine of thread.filter((m) => m.isFromMe && m.receivedAt < email.receivedAt && !m.repliedAt)) await this.db.emails.update({ ...mine, repliedAt: email.receivedAt, updatedAt: now });
    }
    await this.db.search.index({ itemId: email.id, itemType: 'REFERENCE', title: email.subject, content: bodyText.slice(0, 5000), tags: ['email', analysis.kind], people: [email.from.name ?? email.from.email] }).catch(() => undefined);
    return email;
  }

  /** Re-analyses with the LLM when available and merges with the deterministic result (deterministic facts win on conflicts). */
  /** The email's own language (detected from its text) drives the deterministic cues, not the UI language. */
  private languageOf(subject: string, bodyText: string): Language {
    return detectLanguage(`${subject} ${bodyText.slice(0, 600)}`, this.language()).language;
  }

  async analyze(id: string): Promise<EmailMessage> {
    const email = await this.require(id);
    const deterministic = analyzeEmail({ subject: email.subject, bodyText: email.bodyText, isFromMe: email.isFromMe, fromEmail: email.from.email, language: this.languageOf(email.subject, email.bodyText), now: this.clock.now(), timezone: this.clock.timezone() });
    let analysis: EmailAnalysis = deterministic;
    if (this.ai.isAvailable() && !email.isFromMe) {
      try {
        const llm = await this.ai.structured({ system: ANALYZE_SYSTEM_PROMPT, user: `${wrapUntrusted('email', `From: ${email.from.name ?? ''} <${email.from.email}>\nSubject: ${email.subject}\n\n${clampForPrompt(email.bodyText)}`)}\n\nAnalyse this email.`, maxTokens: 800 }, LLMAnalysisSchema);
        analysis = {
          ...deterministic,
          kind: deterministic.kind === 'newsletter' || deterministic.kind === 'payment_required' ? deterministic.kind : (llm.kind as EmailAnalysis['kind']),
          needsReply: deterministic.suspicious ? deterministic.needsReply : llm.needsReply || deterministic.needsReply,
          summary: llm.summary ?? deterministic.summary,
          requests: llm.requests.length ? llm.requests : deterministic.requests,
          questions: llm.questions.length ? llm.questions : deterministic.questions,
          senderCommitments: Array.from(new Set([...deterministic.senderCommitments, ...llm.senderCommitments])).slice(0, 5),
          documentRequest: deterministic.documentRequest ?? llm.documentRequest,
          confidence: Math.max(deterministic.confidence, llm.confidence),
          method: 'llm',
        };
      } catch {
        analysis = deterministic;
      }
    }
    const next: EmailMessage = { ...email, analysis, updatedAt: this.clock.nowISO() };
    await this.db.emails.update(next);
    return next;
  }

  async require(id: string): Promise<EmailMessage> {
    const email = await this.db.emails.getById(id);
    if (!email) throw new DomainError('NOT_FOUND', 'Email not found');
    return email;
  }

  get(id: string): Promise<EmailMessage | null> {
    return this.db.emails.getById(id);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  search(options: EmailSearchOptions = {}): Promise<EmailMessage[]> {
    return this.db.emails.list({ view: options.view ?? 'all', kind: options.kind ?? null, query: options.query ?? null, from: options.from ?? null, limit: options.limit ?? 50 });
  }

  /** "Welke mails moet ik nog beantwoorden?" – action required, not merely unread (§95). */
  needsReply(): Promise<EmailMessage[]> {
    return this.db.emails.list({ view: 'needs_reply', limit: 100 });
  }

  /** Mails I sent that got no answer yet, oldest first. */
  async waitingForReply(minDays = 0): Promise<EmailMessage[]> {
    const mails = await this.db.emails.list({ view: 'waiting', limit: 100 });
    const cutoff = this.clock.now().minus({ days: minDays }).toMillis();
    return mails.filter((m) => !m.repliedAt && new Date(m.receivedAt).getTime() <= cutoff).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  /** "Open de laatste mail van Fabrice" / "die mail van de recruiter". */
  async findLatest(query: { from?: string | null; topic?: string | null; audience?: Audience | null }): Promise<EmailMessage | null> {
    let candidates = await this.db.emails.list({ view: 'all', limit: 200 });
    candidates = candidates.filter((m) => !m.isFromMe);
    if (query.audience) {
      const contacts = (await this.db.contacts.list()).filter((c) => c.audience === query.audience);
      const ids = new Set(contacts.map((c) => c.id));
      const emails = new Set(contacts.map((c) => c.email?.toLowerCase()).filter((e): e is string => Boolean(e)));
      const byAudience = candidates.filter((m) => (m.contactId && ids.has(m.contactId)) || emails.has(m.from.email.toLowerCase()) || new RegExp(query.audience as string, 'i').test(`${m.subject} ${m.bodyText.slice(0, 400)} ${m.from.name ?? ''} ${m.from.email}`));
      if (byAudience.length) return byAudience[0] ?? null;
    }
    if (query.from) {
      const needle = query.from.toLowerCase();
      const byFrom = candidates.filter((m) => (m.from.name ?? '').toLowerCase().includes(needle) || m.from.email.toLowerCase().includes(needle));
      if (byFrom.length) return byFrom[0] ?? null;
      const contacts = await this.companies.findContact(query.from);
      if (contacts.best && !contacts.ambiguous) {
        const byContact = candidates.filter((m) => m.contactId === contacts.best?.id);
        if (byContact.length) return byContact[0] ?? null;
      }
    }
    if (query.topic) {
      const match = findBestMatch(query.topic, candidates, (m) => `${m.subject} ${m.snippet}`, 0.3);
      if (match.best) return match.best;
      const tokens = tokenize(query.topic);
      const loose = candidates.find((m) => tokens.some((t) => `${m.subject} ${m.bodyText}`.toLowerCase().includes(t)));
      if (loose) return loose;
    }
    return null;
  }

  async thread(email: EmailMessage): Promise<EmailMessage[]> {
    return email.threadId ? this.db.emails.listThread(email.threadId) : [email];
  }

  /** "Wat wil hij van mij?" – the requested actions, from analysis (LLM refined when available). */
  async briefing(id: string): Promise<EmailBriefing> {
    let email = await this.require(id);
    if (!email.analysis || (email.analysis.method === 'deterministic' && this.ai.isAvailable())) email = await this.analyze(id);
    const analysis = email.analysis;
    const requested = analysis ? Array.from(new Set([...analysis.requests, ...(analysis.documentRequest ? [analysis.documentRequest] : []), ...analysis.deadlines.map((d) => d.phrase)])) : [];
    const thread = await this.thread(email);
    const contact = email.contactId ? await this.db.contacts.getById(email.contactId) : null;
    const summary = analysis?.summary ?? email.snippet;
    return { email, thread, summary, requested, contact };
  }

  async markRead(id: string): Promise<void> {
    const email = await this.require(id);
    if (!email.isRead) await this.db.emails.update({ ...email, isRead: true, updatedAt: this.clock.nowISO() });
  }

  async markHandled(id: string): Promise<EmailMessage> {
    const email = await this.require(id);
    const next: EmailMessage = { ...email, handledAt: this.clock.nowISO(), updatedAt: this.clock.nowISO() };
    await this.db.emails.update(next);
    return next;
  }

  async assignProject(id: string, projectId: string | null): Promise<EmailMessage> {
    const email = await this.require(id);
    const next: EmailMessage = { ...email, projectId, updatedAt: this.clock.nowISO() };
    await this.db.emails.update(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await this.db.emails.delete(id);
    await this.db.search.remove(id).catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Drafting (§96)
  // ---------------------------------------------------------------------------

  async draftReply(emailId: string, instruction: string, options: { style?: CommunicationStyle | null; audience?: Audience | null; guideline?: boolean } = {}): Promise<EmailDraft> {
    const email = await this.require(emailId);
    const contact = email.contactId ? await this.db.contacts.getById(email.contactId) : null;
    const style = options.style ?? (await this.companies.styleFor(contact, options.audience ?? null));
    const recipientName = contact?.name ?? email.from.name ?? null;
    const subject = /^(?:re|aw|antw|réf)\s*:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
    const existing = await this.db.emailDrafts.latestForEmail(emailId);
    const body = await this.generateBody({ email, recipientName, instruction, style, previousBody: null, guideline: options.guideline === true });
    const now = this.clock.nowISO();
    if (existing) {
      const updated: EmailDraft = { ...existing, body, subject, style, instruction, version: existing.version + 1, updatedAt: now };
      await this.db.emailDrafts.update(updated);
      return updated;
    }
    const draft: EmailDraft = { id: newId(), replyToEmailId: emailId, to: [email.from], subject, body, style, instruction, version: 1, status: 'draft', sentAt: null, createdAt: now, updatedAt: now };
    await this.db.emailDrafts.insert(draft);
    return draft;
  }

  /** New message to a contact ("Vraag Sven of hij dit kan nakijken"). */
  async compose(to: { contact?: Contact | null; address?: EmailAddress | null }, instruction: string, subject: string | null, options: { style?: CommunicationStyle | null } = {}): Promise<EmailDraft> {
    const contact = to.contact ?? null;
    const address: EmailAddress | null = to.address ?? (contact?.email ? { name: contact.name, email: contact.email } : null);
    if (!address) throw new DomainError('INVALID_ARGUMENTS', `No email address known for ${contact?.name ?? 'this contact'}`);
    const style = options.style ?? (await this.companies.styleFor(contact, null));
    const body = await this.generateBody({ email: null, recipientName: contact?.name ?? address.name, instruction, style, previousBody: null });
    const now = this.clock.nowISO();
    const draft: EmailDraft = { id: newId(), replyToEmailId: null, to: [address], subject: subject ?? instructionSubject(instruction, this.language()), body, style, instruction, version: 1, status: 'draft', sentAt: null, createdAt: now, updatedAt: now };
    await this.db.emailDrafts.insert(draft);
    return draft;
  }

  /** "Maak het iets professioneler." / "Zeg ook dat ik maandag beschikbaar ben." – updates the same draft (§96). */
  async refineDraft(draftId: string, instruction: string): Promise<EmailDraft> {
    const draft = await this.requireDraft(draftId);
    if (draft.status !== 'draft') throw new DomainError('VALIDATION_FAILED', 'This draft was already sent');
    const email = draft.replyToEmailId ? await this.db.emails.getById(draft.replyToEmailId) : null;
    const contact = email?.contactId ? await this.db.contacts.getById(email.contactId) : null;
    const { style, matched } = styleFromInstruction(instruction, draft.style ?? 'professional');
    const recipientName = contact?.name ?? draft.to[0]?.name ?? null;
    const body = await this.generateBody({ email, recipientName, instruction: matched ? '' : instruction, style, previousBody: draft.body, refinement: instruction });
    const next: EmailDraft = { ...draft, body, style, instruction: matched ? draft.instruction : `${draft.instruction ?? ''}\n${instruction}`.trim(), version: draft.version + 1, updatedAt: this.clock.nowISO() };
    await this.db.emailDrafts.update(next);
    return next;
  }

  async requireDraft(id: string): Promise<EmailDraft> {
    const draft = await this.db.emailDrafts.getById(id);
    if (!draft) throw new DomainError('NOT_FOUND', 'Draft not found');
    return draft;
  }

  getDraft(id: string): Promise<EmailDraft | null> {
    return this.db.emailDrafts.getById(id);
  }

  listDrafts(): Promise<EmailDraft[]> {
    return this.db.emailDrafts.listOpen();
  }

  async updateDraftText(id: string, patch: { subject?: string; body?: string }): Promise<EmailDraft> {
    const draft = await this.requireDraft(id);
    const next: EmailDraft = { ...draft, subject: patch.subject ?? draft.subject, body: patch.body ?? draft.body, version: draft.version + 1, updatedAt: this.clock.nowISO() };
    await this.db.emailDrafts.update(next);
    return next;
  }

  /** Called by the external send tool *after* transport succeeded or the composer was opened. */
  async markSent(id: string): Promise<EmailDraft> {
    const draft = await this.requireDraft(id);
    const now = this.clock.nowISO();
    const next: EmailDraft = { ...draft, status: 'sent', sentAt: now, updatedAt: now };
    await this.db.emailDrafts.update(next);
    if (draft.replyToEmailId) {
      const email = await this.db.emails.getById(draft.replyToEmailId);
      if (email) await this.db.emails.update({ ...email, repliedAt: now, updatedAt: now });
    }
    return next;
  }

  async discardDraft(id: string): Promise<void> {
    const draft = await this.requireDraft(id);
    await this.db.emailDrafts.update({ ...draft, status: 'discarded', updatedAt: this.clock.nowISO() });
  }

  private async generateBody(params: { email: EmailMessage | null; recipientName: string | null; instruction: string; style: CommunicationStyle; previousBody: string | null; refinement?: string; guideline?: boolean }): Promise<string> {
    const language = this.language();
    const signature = this.signature();
    if (this.ai.isAvailable()) {
      try {
        const prefs = await this.companies.communicationPreferences();
        const lines = [
          `Language: ${language}`,
          `Style: ${styleLabel(params.style, language)}`,
          prefs.rules.length ? `User's standing rules: ${prefs.rules.join('; ')}` : '',
          signature ? `Sign as: ${signature}` : '',
          params.recipientName ? `Recipient: ${params.recipientName}` : '',
          params.email ? wrapUntrusted('original_email', `Subject: ${params.email.subject}\n\n${clampForPrompt(params.email.bodyText, 4000)}`) : '',
          params.previousBody ? `Current draft (written by the assistant earlier, keep its content unless the instruction changes it):\n${params.previousBody}` : '',
          params.refinement ? `Refinement instruction from the user: ${params.refinement}` : '',
          params.instruction ? (params.guideline ? `Guideline for the reply (how to answer; never quote it): ${params.instruction}` : `Instruction from the user (what the reply must say): ${params.instruction}`) : '',
          'Write the reply now.',
        ].filter(Boolean);
        const out = await this.ai.structured({ system: DRAFT_SYSTEM_PROMPT, user: lines.join('\n\n'), maxTokens: 1200 }, DraftOutputSchema);
        if (out.body.trim()) return out.body.trim();
      } catch {
        // fall through to the deterministic draft
      }
    }
    const previousCore = params.previousBody ? extractCore(params.previousBody, language) : null;
    return composeDraftBody({ recipientName: params.recipientName, instruction: params.instruction, style: params.style, language, signature, previousCore, guideline: params.guideline === true }).body;
  }

  // ---------------------------------------------------------------------------
  // Suggestions from content (§127) – proposals only, never applied silently
  // ---------------------------------------------------------------------------

  suggestionsFor(email: EmailMessage): Omit<Suggestion, 'id' | 'status' | 'resultType' | 'resultId' | 'createdAt' | 'resolvedAt'>[] {
    const a = email.analysis;
    if (!a || email.isFromMe) return [];
    const base = { sourceType: 'email' as const, sourceId: email.id, projectId: email.projectId };
    const out: Omit<Suggestion, 'id' | 'status' | 'resultType' | 'resultId' | 'createdAt' | 'resolvedAt'>[] = [];
    const who = email.from.name ?? email.from.email;
    for (const request of a.requests.slice(0, 3)) {
      const deadline = a.deadlines[0]?.date ?? null;
      out.push({ ...base, kind: 'task', title: request.length > 90 ? `${request.slice(0, 87)}…` : request, payload: { dueDate: deadline, who, emailId: email.id, source: `email from ${who}` } });
    }
    if (a.documentRequest && !a.requests.includes(a.documentRequest)) out.push({ ...base, kind: 'document_request', title: a.documentRequest, payload: { who, dueDate: a.deadlines[0]?.date ?? null, emailId: email.id } });
    for (const commitment of a.senderCommitments.slice(0, 3)) out.push({ ...base, kind: 'follow_up', title: commitment, payload: { who, expectedDate: a.deadlines[0]?.date ?? null, emailId: email.id } });
    if (a.invoiceHints && (a.invoiceHints.amountCents !== null || a.invoiceHints.iban)) out.push({ ...base, kind: 'invoice', title: `${email.subject} (${who})`, payload: { emailId: email.id, amountCents: a.invoiceHints.amountCents, dueDate: a.invoiceHints.dueDate, reference: a.invoiceHints.reference } });
    if (a.appointment?.date) out.push({ ...base, kind: 'meeting', title: `${email.subject} (${who})`, payload: { date: a.appointment.date, time: a.appointment.time, who, emailId: email.id } });
    return out;
  }
}

function instructionSubject(instruction: string, language: Language): string {
  const words = tokenize(instruction).filter((w) => w.length > 2).slice(0, 5).join(' ');
  const fallback: Record<Language, string> = { nl: 'Vraag', en: 'Question', fr: 'Question' };
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : fallback[language];
}
