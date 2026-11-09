import type { Database } from '../../db/Database';
import { OutboxEventRepository } from '../../db/repositories/ops/SystemRepositories';
import type { SqlExecutor } from '../../db/SqlDriver';
import type { OutboxEvent } from '../../domain/ops';
import type { Logger } from '../../logging/logger';
import type { Clock } from '../../services/Clock';
import { newId } from '../../util/id';

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

const MAX_DISPATCH_ATTEMPTS = 5;

/**
 * Transactional outbox (§166). `publish` writes the event in the same transaction as the
 * state change when the caller passes its executor; a worker dispatches pending rows to
 * in-process subscribers (workflow engine, notifications, CRM). No message broker.
 */
export class OutboxService {
  private readonly handlers = new Map<string, OutboxHandler[]>();

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly logger?: Logger,
  ) {}

  async publish(type: string, payload: Record<string, unknown>, executor?: SqlExecutor): Promise<OutboxEvent> {
    const event: OutboxEvent = { id: newId(), type, payload, status: 'pending', attempts: 0, lastError: null, createdAt: this.clock.nowISO(), publishedAt: null };
    const repo = executor ? new OutboxEventRepository(executor) : this.db.outboxEvents;
    await repo.insert(event);
    return event;
  }

  /** `type` may be an exact event type, a prefix ending in '.' ("ticket.") or '*'. */
  subscribe(type: string, handler: OutboxHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(type, current.filter((h) => h !== handler));
    };
  }

  handlersFor(type: string): OutboxHandler[] {
    const out: OutboxHandler[] = [];
    for (const [key, list] of this.handlers) {
      if (key === '*' || key === type || (key.endsWith('.') && type.startsWith(key))) out.push(...list);
    }
    return out;
  }

  async dispatchPending(limit = 50): Promise<{ published: number; failed: number }> {
    const events = await this.db.outboxEvents.listPending(limit);
    let published = 0;
    let failed = 0;
    for (const event of events) {
      try {
        for (const handler of this.handlersFor(event.type)) await handler(event);
        await this.db.outboxEvents.markPublished(event.id, this.clock.nowISO());
        published++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const permanent = event.attempts + 1 >= MAX_DISPATCH_ATTEMPTS;
        await this.db.outboxEvents.markFailed(event.id, message, permanent);
        this.logger?.warn('outbox dispatch failed', { type: event.type, id: event.id, message, permanent });
        failed++;
      }
    }
    return { published, failed };
  }

  pendingCount(): Promise<number> {
    return this.db.outboxEvents.countPending();
  }

  listRecent(limit = 100): Promise<OutboxEvent[]> {
    return this.db.outboxEvents.listRecent(limit);
  }
}
