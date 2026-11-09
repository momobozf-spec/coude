import { DateTime } from 'luxon';

import type { ReminderScheduler } from './ReminderScheduler';
import type { Database } from '../../db/Database';
import type { DocumentFilter } from '../../db/repositories/admin/DocumentRepositories';
import { EXPIRING_DOCUMENT_TYPES, type AdminDocument, type DocumentSource, type DocumentType } from '../../domain/admin';
import { parseDateToken } from '../../finance/extraction';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

export interface DocumentInput {
  type?: DocumentType;
  title: string;
  sender?: string | null;
  recipient?: string | null;
  date?: string | null;
  expiryDate?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  tags?: string[];
  attachmentUri?: string | null;
  mimeType?: string | null;
  extractedText?: string | null;
  source?: DocumentSource;
}

const EXPIRY_KEYWORDS = ['geldig tot', 'geldig t/m', 'vervalt op', 'vervaldatum', 'loopt af op', 'einddatum', 'tot en met', 'valid until', 'valid through', 'expires on', 'expiry date', 'expiration date', 'end date', 'renewal date', 'valable jusqu', "date d'expiration", 'expire le', 'fin de contrat', 'date de fin'];
const TYPE_KEYWORDS: [DocumentType, RegExp][] = [
  ['contract', /\b(contract|overeenkomst|agreement|contrat)\b/i],
  ['insurance', /\b(verzekering|polis|insurance|policy|assurance)\b/i],
  ['quote', /\b(offerte|quote|quotation|devis)\b/i],
  ['invoice', /\b(factuur|invoice|facture)\b/i],
  ['vehicle', /\b(keuring|inspectie|voertuig|vehicle|inspection|contrôle technique|controle technique|kenteken)\b/i],
  ['tax', /\b(belasting|aangifte|btw|tax|vat|impôt|impot|tva)\b/i],
  ['certificate', /\b(certificaat|certificate|attest|certificat|diploma)\b/i],
  ['license', /\b(licentie|vergunning|license|licence|permis)\b/i],
  ['subscription', /\b(abonnement|subscription)\b/i],
  ['receipt', /\b(kassabon|ticket|receipt|reçu|recu|bon)\b/i],
];

/** Documents (§109) and expiry detection with opt-in reminders (§110). */
export class DocumentService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly reminders: () => ReminderScheduler,
  ) {}

  async create(input: DocumentInput): Promise<AdminDocument> {
    const title = input.title.trim();
    if (!title) throw new DomainError('VALIDATION_FAILED', 'Document needs a title');
    const now = this.clock.nowISO();
    const text = input.extractedText ?? null;
    const doc: AdminDocument = {
      id: newId(),
      type: input.type ?? (text ? detectDocumentType(`${title}\n${text}`) : detectDocumentType(title)),
      title,
      sender: input.sender ?? null,
      recipient: input.recipient ?? null,
      date: input.date ?? this.clock.today(),
      expiryDate: input.expiryDate ?? (text ? detectExpiryDate(text) : null),
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      tags: input.tags ?? [],
      attachmentUri: input.attachmentUri ?? null,
      mimeType: input.mimeType ?? null,
      extractedText: text,
      source: input.source ?? 'manual',
      reminderId: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.documents.insert(doc);
    await this.db.search.index({ itemId: doc.id, itemType: 'REFERENCE', title: doc.title, content: (doc.extractedText ?? '').slice(0, 5000), tags: [doc.type, ...doc.tags], people: [doc.sender ?? '', doc.recipient ?? ''].filter(Boolean) }).catch(() => undefined);
    return doc;
  }

  async update(id: string, patch: Partial<DocumentInput> & { archived?: boolean }): Promise<AdminDocument> {
    const doc = await this.require(id);
    const next: AdminDocument = { ...doc, ...patch, title: patch.title?.trim() || doc.title, tags: patch.tags ?? doc.tags, archived: patch.archived ?? doc.archived, updatedAt: this.clock.nowISO() } as AdminDocument;
    await this.db.documents.update(next);
    return next;
  }

  async require(id: string): Promise<AdminDocument> {
    const doc = await this.db.documents.getById(id);
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found');
    return doc;
  }

  get(id: string): Promise<AdminDocument | null> {
    return this.db.documents.getById(id);
  }

  list(filter: DocumentFilter = {}): Promise<AdminDocument[]> {
    return this.db.documents.list(filter);
  }

  /** "Zoek mijn contract met klant X." */
  async search(query: string | null, options: { type?: DocumentType | null; companyId?: string | null; projectId?: string | null } = {}): Promise<AdminDocument[]> {
    return this.db.documents.list({ query, type: options.type ?? null, companyId: options.companyId ?? null, projectId: options.projectId ?? null, limit: 50 });
  }

  /** Documents whose expiry date falls within `withinDays` (default 60), soonest first. */
  async expiring(withinDays = 60, type: DocumentType | null = null): Promise<AdminDocument[]> {
    const limit = DateTime.fromISO(this.clock.today(), { zone: this.clock.timezone() }).plus({ days: withinDays }).toISODate() ?? this.clock.today();
    const docs = await this.db.documents.list({ expiringBefore: limit, type, limit: 100 });
    return docs.filter((d) => EXPIRING_DOCUMENT_TYPES.includes(d.type) || d.expiryDate !== null);
  }

  /** Creates the reminder the user accepted for a document expiry (§110) – never automatically. */
  async remindBeforeExpiry(id: string, daysBefore: number, language: Language): Promise<{ document: AdminDocument; reminderId: string; dueISO: string }> {
    const doc = await this.require(id);
    if (!doc.expiryDate) throw new DomainError('INVALID_ARGUMENTS', 'This document has no expiry date');
    let fire: DateTime = DateTime.fromISO(doc.expiryDate, { zone: this.clock.timezone() }).minus({ days: Math.max(0, daysBefore) }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    if (fire < this.clock.now()) fire = this.clock.now().plus({ minutes: 5 });
    const dueISO = fire.toISO({ suppressMilliseconds: true }) ?? doc.expiryDate;
    const title = { en: `${doc.title} expires on ${doc.expiryDate}`, nl: `${doc.title} vervalt op ${doc.expiryDate}`, fr: `${doc.title} expire le ${doc.expiryDate}` }[language];
    const { reminderId } = await this.reminders()({ title, dueISO, notes: null });
    const next = await this.update(id, {});
    const withReminder: AdminDocument = { ...next, reminderId };
    await this.db.documents.update(withReminder);
    return { document: withReminder, reminderId, dueISO };
  }

  async delete(id: string): Promise<void> {
    await this.db.documents.delete(id);
    await this.db.search.remove(id).catch(() => undefined);
  }
}

export function detectDocumentType(text: string): DocumentType {
  for (const [type, re] of TYPE_KEYWORDS) if (re.test(text)) return type;
  return 'other';
}

/** Finds "geldig tot 31/12/2026", "valid until 2026-12-31", "expire le 31 décembre 2026". */
export function detectExpiryDate(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of EXPIRY_KEYWORDS) {
    const idx = lower.indexOf(keyword);
    if (idx < 0) continue;
    const tail = text.slice(idx + keyword.length, idx + keyword.length + 40);
    const m = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+[\p{L}.]+\s+\d{4})/u.exec(tail);
    if (m && m[1]) {
      const date = parseDateToken(m[1]);
      if (date) return date;
    }
  }
  return null;
}
