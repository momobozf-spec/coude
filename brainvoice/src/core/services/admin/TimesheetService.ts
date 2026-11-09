import type { CompanyService } from './CompanyService';
import type { InvoiceService } from './InvoiceService';
import type { Database } from '../../db/Database';
import type { TimeEntryFilter } from '../../db/repositories/admin/FinanceRepositories';
import { MINUTES_PER_WORKDAY, type Invoice, type RateUnit, type TimeEntry, type TimeEntryStatus } from '../../domain/admin';
import type { LineInput } from '../../finance/InvoiceEngine';
import { roundHalfUp } from '../../finance/money';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

export interface TimeEntryInput {
  date?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  description?: string | null;
  minutes: number;
  billable?: boolean;
  rateCents?: number | null;
  rateUnit?: RateUnit;
  status?: TimeEntryStatus;
}

export interface TimesheetSummary {
  from: string | null;
  to: string | null;
  projectId: string | null;
  companyId: string | null;
  entries: TimeEntry[];
  totalMinutes: number;
  billableMinutes: number;
  uninvoicedMinutes: number;
  /** Billable minutes expressed in 8-hour days, 2 decimals. */
  days: number;
  byDate: { date: string; minutes: number }[];
}

const LINE_LABEL: Record<Language, { day: string; hour: string; period: string }> = {
  en: { day: 'Consulting services (days)', hour: 'Consulting services (hours)', period: 'Services' },
  nl: { day: 'Prestaties (werkdagen)', hour: 'Prestaties (uren)', period: 'Prestaties' },
  fr: { day: 'Prestations (jours)', hour: 'Prestations (heures)', period: 'Prestations' },
};

/** Timesheets (§107): entries, summaries and invoice drafts from approved billable time. */
export class TimesheetService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly companies: CompanyService,
    private readonly invoices: InvoiceService,
  ) {}

  async create(input: TimeEntryInput): Promise<TimeEntry> {
    if (!Number.isFinite(input.minutes) || input.minutes <= 0) throw new DomainError('VALIDATION_FAILED', 'Minutes must be positive');
    let companyId = input.companyId ?? null;
    if (!companyId && input.projectId) {
      const project = await this.db.projects.getById(input.projectId);
      companyId = project?.companyId ?? null;
    }
    const profile = await this.companies.profile();
    const rateUnit = input.rateUnit ?? 'day';
    const now = this.clock.nowISO();
    const entry: TimeEntry = {
      id: newId(),
      date: input.date ?? this.clock.today(),
      projectId: input.projectId ?? null,
      companyId,
      description: input.description ?? null,
      minutes: Math.round(input.minutes),
      billable: input.billable ?? true,
      rateCents: input.rateCents ?? (rateUnit === 'day' ? profile.defaultDayRateCents : profile.defaultHourRateCents),
      rateUnit,
      status: input.status ?? 'approved',
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.timeEntries.insert(entry);
    return entry;
  }

  async update(id: string, patch: Partial<TimeEntryInput>): Promise<TimeEntry> {
    const entry = await this.db.timeEntries.getById(id);
    if (!entry) throw new DomainError('NOT_FOUND', 'Time entry not found');
    if (entry.status === 'invoiced') throw new DomainError('FINANCIAL_SAFETY', 'Invoiced time entries cannot be changed');
    const next: TimeEntry = { ...entry, ...patch, date: patch.date ?? entry.date, minutes: patch.minutes !== undefined ? Math.round(patch.minutes) : entry.minutes, updatedAt: this.clock.nowISO() } as TimeEntry;
    await this.db.timeEntries.update(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const entry = await this.db.timeEntries.getById(id);
    if (entry?.status === 'invoiced') throw new DomainError('FINANCIAL_SAFETY', 'Invoiced time entries cannot be deleted');
    await this.db.timeEntries.delete(id);
  }

  list(filter: TimeEntryFilter = {}): Promise<TimeEntry[]> {
    return this.db.timeEntries.list(filter);
  }

  async summary(filter: TimeEntryFilter = {}): Promise<TimesheetSummary> {
    const entries = await this.db.timeEntries.list({ ...filter, status: filter.status ?? 'all' });
    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
    const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0);
    const uninvoicedMinutes = entries.filter((e) => e.billable && e.status !== 'invoiced').reduce((s, e) => s + e.minutes, 0);
    const byDateMap = new Map<string, number>();
    for (const e of entries) byDateMap.set(e.date, (byDateMap.get(e.date) ?? 0) + e.minutes);
    return {
      from: filter.from ?? null,
      to: filter.to ?? null,
      projectId: filter.projectId ?? null,
      companyId: filter.companyId ?? null,
      entries,
      totalMinutes,
      billableMinutes,
      uninvoicedMinutes,
      days: roundHalfUp((billableMinutes / MINUTES_PER_WORKDAY) * 100) / 100,
      byDate: [...byDateMap.entries()].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * "Maak mijn factuur voor september": one invoice draft per customer from approved,
   * billable, not-yet-invoiced entries in the period. Entries are grouped by rate so the
   * invoice lines stay exact; day rates use 8-hour days.
   */
  async buildInvoiceDraft(params: { from: string; to: string; companyId?: string | null; projectId?: string | null; language: Language }): Promise<{ invoice: Invoice; entries: TimeEntry[] }> {
    const entries = (await this.db.timeEntries.list({ from: params.from, to: params.to, companyId: params.companyId ?? null, projectId: params.projectId ?? null, status: 'approved', billable: true })).filter((e) => e.invoiceId === null);
    if (entries.length === 0) throw new DomainError('NOT_FOUND', 'No approved billable time in this period', { details: { from: params.from, to: params.to } });
    const companyIds = Array.from(new Set(entries.map((e) => e.companyId).filter((id): id is string => Boolean(id))));
    if (companyIds.length > 1 && !params.companyId) throw new DomainError('AMBIGUOUS_COMMAND', 'Time entries span several customers; say which one', { details: { candidates: await Promise.all(companyIds.map(async (id) => ({ id, title: (await this.db.companies.getById(id))?.name ?? id }))) } });
    const companyId = params.companyId ?? companyIds[0] ?? null;
    const profile = await this.companies.profile();
    const labels = LINE_LABEL[params.language];
    const groups = new Map<string, { unit: RateUnit; rateCents: number; minutes: number }>();
    for (const e of entries) {
      const rate = e.rateCents ?? (e.rateUnit === 'day' ? profile.defaultDayRateCents : profile.defaultHourRateCents);
      if (rate === null) throw new DomainError('PROFILE_INCOMPLETE', 'No rate configured for these time entries; set a default day or hour rate in the business profile', { details: { missing: ['defaultDayRateCents'] } });
      const key = `${e.rateUnit}:${rate}`;
      const group = groups.get(key) ?? { unit: e.rateUnit, rateCents: rate, minutes: 0 };
      group.minutes += e.minutes;
      groups.set(key, group);
    }
    const lines: LineInput[] = [...groups.values()].map((g) => ({
      description: `${g.unit === 'day' ? labels.day : labels.hour} ${params.from} – ${params.to}`,
      quantity: g.unit === 'day' ? roundHalfUp((g.minutes / MINUTES_PER_WORKDAY) * 100) / 100 : roundHalfUp((g.minutes / 60) * 100) / 100,
      unit: g.unit,
      unitPriceCents: g.rateCents,
    }));
    const invoice = await this.invoices.createOutgoingDraft({ companyId, counterpartyName: companyId ? null : '?', lines, servicePeriodStart: params.from, servicePeriodEnd: params.to, description: labels.period, source: 'timesheet', timeEntryIds: entries.map((e) => e.id), projectId: params.projectId ?? entries[0]?.projectId ?? null });
    return { invoice, entries };
  }
}
