import type { Clock } from './Clock';
import type { ToolUndo } from '../butler/ToolRegistry';
import type { Database } from '../db/Database';
import type { ActionHistoryEntry, UndoStatus } from '../domain/entities';
import type { ConversationState } from '../intent/ContextResolver';
import { EMPTY_CONVERSATION_STATE } from '../intent/ContextResolver';
import type { Command } from '../intent/schema';
import { newId } from '../util/id';

/** Serialisable description of how to undo an executed command. */
export type UndoPlan =
  | { kind: 'delete_note'; noteId: string; captureId: string | null }
  | { kind: 'delete_task'; taskId: string; captureId: string | null; notificationId: string | null }
  | { kind: 'delete_event'; eventId: string; externalId: string | null; captureId: string | null }
  | { kind: 'delete_reminder'; reminderId: string; backend: 'eventkit' | 'notification' | 'none'; externalId: string | null; notificationId: string | null; captureId: string | null }
  | { kind: 'cancel_alarm'; alarmId: string; record: { backend: string; externalId: string | null; notificationId: string | null; canCancel: boolean } }
  | { kind: 'restore_task'; taskId: string; previous: Record<string, unknown> }
  | { kind: 'restore_event'; eventId: string; externalId: string | null; previous: Record<string, unknown> }
  | { kind: 'recreate_event'; eventId: string; previous: Record<string, unknown> }
  | { kind: 'restore_reminder'; reminderId: string; previous: Record<string, unknown> }
  | { kind: 'tool_undo'; undo: ToolUndo }
  | { kind: 'none'; reason: string };

export class HistoryService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async record(params: { batchId: string; originalText: string; command: Command; summary: string; externalIds: Record<string, string>; plan: UndoPlan; error?: string | null }): Promise<ActionHistoryEntry> {
    const entry: ActionHistoryEntry = {
      id: newId(),
      batchId: params.batchId,
      commandId: params.command.id,
      intent: params.command.intent,
      commandJson: JSON.stringify(params.command),
      originalText: params.originalText,
      summary: params.summary,
      executedAt: this.clock.nowISO(),
      externalIds: params.externalIds,
      undoStatus: params.error ? 'unavailable' : params.plan.kind === 'none' ? 'unavailable' : 'available',
      undoneAt: null,
      resultJson: JSON.stringify(params.plan),
      errorMessage: params.error ?? null,
    };
    await this.db.history.insert(entry);
    return entry;
  }

  async setUndoStatus(id: string, status: UndoStatus, error: string | null = null): Promise<void> {
    await this.db.history.setUndoStatus(id, status, status === 'undone' ? this.clock.nowISO() : null, error);
  }

  getById(id: string): Promise<ActionHistoryEntry | null> {
    return this.db.history.getById(id);
  }

  listRecent(limit = 50): Promise<ActionHistoryEntry[]> {
    return this.db.history.listRecent(limit);
  }

  listByBatch(batchId: string): Promise<ActionHistoryEntry[]> {
    return this.db.history.listByBatch(batchId);
  }

  planOf(entry: ActionHistoryEntry): UndoPlan {
    try {
      return entry.resultJson ? (JSON.parse(entry.resultJson) as UndoPlan) : { kind: 'none', reason: 'no plan' };
    } catch {
      return { kind: 'none', reason: 'corrupt plan' };
    }
  }
}

export class ContextService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async load(): Promise<ConversationState> {
    return (await this.db.context.load()) ?? EMPTY_CONVERSATION_STATE;
  }

  async save(state: ConversationState): Promise<void> {
    await this.db.context.save(state, this.clock.nowISO());
  }

  async clear(): Promise<void> {
    await this.db.context.clear();
  }
}
