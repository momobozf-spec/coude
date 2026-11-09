import { fromBool, nullable, numberOrNull, toBool, type SqlExecutor, type SqlValue } from '../SqlDriver';
import type { ActionHistoryEntry, Category, KeyValueEntry, OutboxItem, Tag, UndoStatus } from '../../domain/entities';
import type { ConversationState } from '../../intent/ContextResolver';
import type { InputSource, Language } from '../../types/common';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Key/value stores: settings and external_integrations
// ---------------------------------------------------------------------------

export class KeyValueRepository {
  constructor(
    private readonly db: SqlExecutor,
    private readonly table: 'settings' | 'external_integrations',
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.get<{ value: string }>(`SELECT value FROM ${this.table} WHERE key = ?`, [key]);
    return row ? String(row.value) : null;
  }

  async set(key: string, value: string, updatedAt: string): Promise<void> {
    await this.db.run(`INSERT INTO ${this.table} (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [key, value, updatedAt]);
  }

  async delete(key: string): Promise<void> {
    await this.db.run(`DELETE FROM ${this.table} WHERE key = ?`, [key]);
  }

  async all(): Promise<KeyValueEntry[]> {
    const rows = await this.db.all<Row>(`SELECT key, value, updated_at FROM ${this.table}`);
    return rows.map((r) => ({ key: String(r.key), value: String(r.value), updatedAt: String(r.updated_at) }));
  }
}

// ---------------------------------------------------------------------------
// Conversation context
// ---------------------------------------------------------------------------

export class ContextRepository {
  constructor(private readonly db: SqlExecutor) {}

  async load(): Promise<ConversationState | null> {
    const row = await this.db.get<{ state_json: string }>('SELECT state_json FROM conversation_context WHERE id = 1');
    if (!row) return null;
    try {
      return JSON.parse(String(row.state_json)) as ConversationState;
    } catch {
      return null;
    }
  }

  async save(state: ConversationState, updatedAt: string): Promise<void> {
    await this.db.run('INSERT INTO conversation_context (id, state_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at', [JSON.stringify(state), updatedAt]);
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM conversation_context');
  }
}

// ---------------------------------------------------------------------------
// Tags & categories
// ---------------------------------------------------------------------------

export class TagRepository {
  constructor(private readonly db: SqlExecutor) {}

  async upsert(tag: Tag): Promise<Tag> {
    const existing = await this.db.get<Row>('SELECT * FROM tags WHERE name = ? COLLATE NOCASE', [tag.name]);
    if (existing) return { id: String(existing.id), name: String(existing.name), color: nullable(existing.color), createdAt: String(existing.created_at) };
    await this.db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [tag.id, tag.name, tag.color, tag.createdAt]);
    return tag;
  }

  async attach(itemType: string, itemId: string, tagId: string): Promise<void> {
    await this.db.run('INSERT OR IGNORE INTO item_tags (item_type, item_id, tag_id) VALUES (?, ?, ?)', [itemType, itemId, tagId]);
  }

  async detachAll(itemType: string, itemId: string): Promise<void> {
    await this.db.run('DELETE FROM item_tags WHERE item_type = ? AND item_id = ?', [itemType, itemId]);
  }

  async list(): Promise<Tag[]> {
    const rows = await this.db.all<Row>('SELECT * FROM tags ORDER BY name');
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), color: nullable(r.color), createdAt: String(r.created_at) }));
  }
}

export class CategoryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async list(): Promise<Category[]> {
    const rows = await this.db.all<Row>('SELECT * FROM categories ORDER BY sort_order, name');
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), icon: nullable(r.icon), color: nullable(r.color), sortOrder: numberOrNull(r.sort_order) ?? 0, isDefault: toBool(r.is_default), createdAt: String(r.created_at) }));
  }

  async upsert(category: Category): Promise<void> {
    await this.db.run(
      'INSERT INTO categories (id, name, icon, color, sort_order, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET icon = excluded.icon, color = excluded.color, sort_order = excluded.sort_order',
      [category.id, category.name, category.icon, category.color, category.sortOrder, fromBool(category.isDefault), category.createdAt],
    );
  }

  async rename(id: string, name: string): Promise<void> {
    await this.db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM categories WHERE id = ? AND is_default = 0', [id]);
  }
}

// ---------------------------------------------------------------------------
// Action history (undo)
// ---------------------------------------------------------------------------

function rowToHistory(r: Row): ActionHistoryEntry {
  let externalIds: Record<string, string> = {};
  try {
    externalIds = JSON.parse(String(r.external_ids_json ?? '{}')) as Record<string, string>;
  } catch {
    externalIds = {};
  }
  return {
    id: String(r.id),
    batchId: String(r.batch_id),
    commandId: String(r.command_id),
    intent: String(r.intent),
    commandJson: String(r.command_json),
    originalText: String(r.original_text ?? ''),
    summary: String(r.summary),
    executedAt: String(r.executed_at),
    externalIds,
    undoStatus: String(r.undo_status) as UndoStatus,
    undoneAt: nullable(r.undone_at),
    resultJson: nullable(r.result_json),
    errorMessage: nullable(r.error_message),
  };
}

export class HistoryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(entry: ActionHistoryEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO action_history (id, batch_id, command_id, intent, command_json, original_text, summary, executed_at, external_ids_json, undo_status, undone_at, result_json, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.batchId, entry.commandId, entry.intent, entry.commandJson, entry.originalText, entry.summary, entry.executedAt, JSON.stringify(entry.externalIds), entry.undoStatus, entry.undoneAt, entry.resultJson, entry.errorMessage],
    );
  }

  async setUndoStatus(id: string, status: UndoStatus, undoneAt: string | null, errorMessage: string | null = null): Promise<void> {
    await this.db.run('UPDATE action_history SET undo_status = ?, undone_at = ?, error_message = COALESCE(?, error_message) WHERE id = ?', [status, undoneAt, errorMessage, id]);
  }

  async getById(id: string): Promise<ActionHistoryEntry | null> {
    const row = await this.db.get<Row>('SELECT * FROM action_history WHERE id = ?', [id]);
    return row ? rowToHistory(row) : null;
  }

  async listRecent(limit = 50): Promise<ActionHistoryEntry[]> {
    const rows = await this.db.all<Row>('SELECT * FROM action_history ORDER BY executed_at DESC LIMIT ?', [limit]);
    return rows.map(rowToHistory);
  }

  async listByBatch(batchId: string): Promise<ActionHistoryEntry[]> {
    const rows = await this.db.all<Row>('SELECT * FROM action_history WHERE batch_id = ? ORDER BY executed_at ASC', [batchId]);
    return rows.map(rowToHistory);
  }
}

// ---------------------------------------------------------------------------
// Outbox (captures waiting for AI / network)
// ---------------------------------------------------------------------------

export class OutboxRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(item: OutboxItem): Promise<void> {
    await this.db.run('INSERT INTO outbox (id, capture_id, text, transcript, language, source, attempts, last_error, created_at, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      item.id, item.captureId, item.text, item.transcript, item.language, item.source, item.attempts, item.lastError, item.createdAt, item.nextAttemptAt,
    ]);
  }

  async listDue(nowISO: string, limit = 20): Promise<OutboxItem[]> {
    const rows = await this.db.all<Row>('SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY created_at ASC LIMIT ?', [nowISO, limit]);
    return rows.map((r) => ({
      id: String(r.id), captureId: nullable(r.capture_id), text: String(r.text), transcript: nullable(r.transcript), language: String(r.language) as Language, source: String(r.source) as InputSource,
      attempts: numberOrNull(r.attempts) ?? 0, lastError: nullable(r.last_error), createdAt: String(r.created_at), nextAttemptAt: String(r.next_attempt_at),
    }));
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return Number(row?.n ?? 0);
  }

  async markAttempt(id: string, error: string | null, nextAttemptAt: string): Promise<void> {
    await this.db.run('UPDATE outbox SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?', [error, nextAttemptAt, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM outbox WHERE id = ?', [id]);
  }
}
