import type { Database } from '../../db/Database';
import type { CostEntry } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import { newId } from '../../util/id';

/**
 * Rough list prices in cents per million tokens, used only to *estimate* spend (§170).
 * Real billing comes from the provider's console; the UI labels every number as an estimate.
 */
export const MODEL_PRICES_PER_MTOK_CENTS: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 1500, output: 7500 },
  'claude-fable-5-1': { input: 1500, output: 7500 },
  'claude-sonnet-5': { input: 300, output: 1500 },
  'claude-haiku-4-5': { input: 100, output: 500 },
  'claude-haiku-4-5-20251001': { input: 100, output: 500 },
};

export function estimateCents(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES_PER_MTOK_CENTS[model] ?? { input: 300, output: 1500 };
  return Math.round((inputTokens * price.input + outputTokens * price.output) / 1_000_000);
}

export interface UsageReport {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ticketId?: string | null;
  jobId?: string | null;
}

/** Non-blocking cost tracking: recording never throws and never delays the work it measures. */
export class CostService {
  private context: { ticketId: string | null; jobId: string | null } = { ticketId: null, jobId: null };

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** Workers set the ticket/job they are processing so provider usage is attributed. */
  setContext(ticketId: string | null, jobId: string | null): void {
    this.context = { ticketId, jobId };
  }

  clearContext(): void {
    this.context = { ticketId: null, jobId: null };
  }

  async record(usage: UsageReport): Promise<CostEntry | null> {
    try {
      const entry: CostEntry = {
        id: newId(),
        ticketId: usage.ticketId ?? this.context.ticketId,
        jobId: usage.jobId ?? this.context.jobId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: Math.max(0, Math.round(usage.inputTokens)),
        outputTokens: Math.max(0, Math.round(usage.outputTokens)),
        estimatedCents: estimateCents(usage.model, usage.inputTokens, usage.outputTokens),
        createdAt: this.clock.nowISO(),
      };
      await this.db.costs.insert(entry);
      if (entry.ticketId && entry.estimatedCents > 0) {
        const ticket = await this.db.tickets.getById(entry.ticketId);
        if (ticket) await this.db.tickets.update({ ...ticket, costCents: ticket.costCents + entry.estimatedCents, updatedAt: this.clock.nowISO() });
      }
      return entry;
    } catch {
      return null;
    }
  }

  today(): Promise<{ cents: number; calls: number; inputTokens: number; outputTokens: number }> {
    const start = this.clock.now().startOf('day').toISO({ suppressMilliseconds: true }) ?? this.clock.today();
    return this.db.costs.sumSince(start);
  }

  forTicket(ticketId: string): Promise<number> {
    return this.db.costs.sumForTicket(ticketId);
  }

  listRecent(limit = 50): Promise<CostEntry[]> {
    return this.db.costs.listRecent(limit);
  }
}
