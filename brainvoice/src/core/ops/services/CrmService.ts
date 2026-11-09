import { DateTime } from 'luxon';

import type { Database } from '../../db/Database';
import type { Company, EmailMessage, FollowUp } from '../../domain/admin';
import type { Interaction, InteractionKind, Quote } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import type { CompanyService } from '../../services/admin/CompanyService';
import type { SuggestionService } from '../../services/admin/SuggestionService';
import type { Language } from '../../types/common';
import { newId } from '../../util/id';

export interface InteractionInput {
  companyId?: string | null;
  contactId?: string | null;
  kind: InteractionKind;
  summary: string;
  occurredAt?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface CompanyTimeline {
  company: Company;
  interactions: Interaction[];
  followUps: FollowUp[];
  quotes: Quote[];
  lastInteractionAt: string | null;
}

export interface InactiveClient {
  company: Company;
  lastInteractionAt: string | null;
  daysSince: number | null;
}

/**
 * Lightweight CRM (§173): interactions are logged from emails, calls, meetings and quotes;
 * the weekly scan proposes follow-ups for silent clients and unanswered quotes – as
 * proposals (suggestions), never as sent messages.
 */
export class CrmService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: { companies: CompanyService; suggestions: SuggestionService; language: () => Language },
  ) {}

  async logInteraction(input: InteractionInput): Promise<Interaction | null> {
    if (input.sourceType && input.sourceId && (await this.db.interactions.existsForSource(input.sourceType, input.sourceId))) return null;
    const nowISO = this.clock.nowISO();
    const interaction: Interaction = { id: newId(), companyId: input.companyId ?? null, contactId: input.contactId ?? null, kind: input.kind, summary: input.summary.trim().slice(0, 300), occurredAt: input.occurredAt ?? nowISO, sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null, createdAt: nowISO };
    await this.db.interactions.insert(interaction);
    await this.touchFollowUps(interaction);
    return interaction;
  }

  /** Emails from/to known contacts become interactions and refresh "last interaction" on waiting-for items. */
  async recordEmail(email: EmailMessage): Promise<Interaction | null> {
    if (!email.contactId && !email.companyId) return null;
    return this.logInteraction({ companyId: email.companyId, contactId: email.contactId, kind: email.isFromMe ? 'email_out' : 'email_in', summary: email.subject || email.snippet, occurredAt: email.receivedAt, sourceType: 'email', sourceId: email.id });
  }

  private async touchFollowUps(interaction: Interaction): Promise<void> {
    if (!interaction.companyId && !interaction.contactId) return;
    const open = await this.db.followUps.list({ status: 'open', limit: 500 });
    for (const f of open) {
      const match = (interaction.contactId && f.contactId === interaction.contactId) || (interaction.companyId && f.companyId === interaction.companyId);
      if (match && (!f.lastInteractionAt || f.lastInteractionAt < interaction.occurredAt)) await this.db.followUps.update({ ...f, lastInteractionAt: interaction.occurredAt, updatedAt: this.clock.nowISO() });
    }
  }

  async timeline(companyId: string): Promise<CompanyTimeline | null> {
    const company = await this.deps.companies.getCompany(companyId);
    if (!company) return null;
    const [interactions, followUps, quotes] = await Promise.all([this.db.interactions.listForCompany(companyId, 50), this.db.followUps.list({ status: 'open', limit: 100 }), this.db.quotes.list({ companyId, status: 'all', limit: 20 })]);
    return { company, interactions, followUps: followUps.filter((f) => f.companyId === companyId), quotes, lastInteractionAt: interactions[0]?.occurredAt ?? null };
  }

  async inactiveClients(days = 60): Promise<InactiveClient[]> {
    const companies = (await this.deps.companies.listCompanies(null)).filter((c) => c.kind === 'client' || c.kind === 'both');
    const latest = await this.db.interactions.latestPerCompany();
    const now = this.clock.now();
    const out: InactiveClient[] = [];
    for (const company of companies) {
      const last = latest[company.id] ?? null;
      const daysSince = last ? Math.floor(now.diff(DateTime.fromISO(last), 'days').days) : null;
      if (daysSince === null || daysSince >= days) out.push({ company, lastInteractionAt: last, daysSince });
    }
    return out.sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
  }

  /** Weekly CRM scan: proposals for silent clients and quotes without an answer (§173). */
  async scan(): Promise<{ proposed: number; skipped: number }> {
    const language = this.deps.language();
    const existing = await this.deps.suggestions.list({ status: 'proposed', sourceType: 'workflow' });
    const seen = new Set(existing.map((s) => s.sourceId));
    const items: Parameters<SuggestionService['propose']>[0] = [];
    let skipped = 0;
    for (const inactive of await this.inactiveClients(60)) {
      const sourceId = `crm:inactive:${inactive.company.id}`;
      if (seen.has(sourceId)) {
        skipped++;
        continue;
      }
      const since = inactive.daysSince === null ? { nl: 'nog geen interactie geregistreerd', en: 'no interaction recorded yet', fr: 'aucune interaction enregistrée' }[language] : `${{ nl: 'laatste interactie', en: 'last interaction', fr: 'dernière interaction' }[language]} ${inactive.daysSince} ${{ nl: 'dagen geleden', en: 'days ago', fr: 'jours' }[language]}`;
      items.push({ kind: 'follow_up', title: `${{ nl: 'Contact opnemen met', en: 'Reach out to', fr: 'Reprendre contact avec' }[language]} ${inactive.company.name}`, payload: { who: inactive.company.name, companyId: inactive.company.id, reason: since, kind: 'follow_up' }, sourceType: 'workflow', sourceId });
    }
    const cutoff = this.clock.now().minus({ days: 7 }).toISO() ?? '';
    for (const quote of await this.db.quotes.list({ status: 'sent', limit: 100 })) {
      if (!quote.sentAt || quote.sentAt > cutoff) continue;
      const sourceId = `crm:quote:${quote.id}`;
      if (seen.has(sourceId)) {
        skipped++;
        continue;
      }
      items.push({ kind: 'follow_up', title: `${{ nl: 'Offerte opvolgen', en: 'Follow up quote', fr: 'Relancer le devis' }[language]} ${quote.quoteNumber ?? ''} – ${quote.counterpartyName}`, payload: { who: quote.counterpartyName, companyId: quote.companyId, quoteId: quote.id, reason: `${{ nl: 'verstuurd op', en: 'sent on', fr: 'envoyé le' }[language]} ${quote.sentAt.slice(0, 10)}`, kind: 'waiting_for' }, sourceType: 'workflow', sourceId });
    }
    if (items.length) await this.deps.suggestions.propose(items);
    return { proposed: items.length, skipped };
  }

  listRecent(limit = 50): Promise<Interaction[]> {
    return this.db.interactions.listRecent(limit);
  }
}
