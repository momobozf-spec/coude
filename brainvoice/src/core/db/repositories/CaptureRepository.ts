import { fromBool, nullable, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../SqlDriver';
import type { Capture, ItemRef, ItemType } from '../../domain/entities';
import type { InputSource, Language } from '../../types/common';

type Row = Record<string, SqlValue>;

function rowToCapture(r: Row): Capture {
  return {
    id: String(r.id),
    type: String(r.type) as ItemType,
    title: String(r.title ?? ''),
    originalText: String(r.original_text ?? ''),
    cleanedText: String(r.cleaned_text ?? ''),
    transcript: nullable(r.transcript),
    language: (nullable(r.language) as Language | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    dueAt: nullable(r.due_at),
    scheduledAt: nullable(r.scheduled_at),
    completedAt: nullable(r.completed_at),
    tags: parseJson<string[]>(r.tags_json, []),
    category: nullable(r.category),
    source: String(r.source) as InputSource,
    linkedItems: parseJson<ItemRef[]>(r.linked_items_json, []),
    metadata: parseJson<Record<string, unknown>>(r.metadata_json, {}),
    processed: toBool(r.processed),
    archived: toBool(r.archived),
    batchId: nullable(r.batch_id),
    commandId: nullable(r.command_id),
  };
}

export class CaptureRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(capture: Capture): Promise<void> {
    await this.db.run(
      `INSERT INTO captures (id, type, title, original_text, cleaned_text, transcript, language, created_at, updated_at, due_at, scheduled_at, completed_at, tags_json, category, source, linked_items_json, metadata_json, processed, archived, batch_id, command_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        capture.id, capture.type, capture.title, capture.originalText, capture.cleanedText, capture.transcript, capture.language, capture.createdAt, capture.updatedAt,
        capture.dueAt, capture.scheduledAt, capture.completedAt, toJson(capture.tags), capture.category, capture.source, toJson(capture.linkedItems), toJson(capture.metadata),
        fromBool(capture.processed), fromBool(capture.archived), capture.batchId, capture.commandId,
      ],
    );
  }

  async update(capture: Capture): Promise<void> {
    await this.db.run(
      `UPDATE captures SET type = ?, title = ?, cleaned_text = ?, transcript = ?, updated_at = ?, due_at = ?, scheduled_at = ?, completed_at = ?, tags_json = ?, category = ?, linked_items_json = ?, metadata_json = ?, processed = ?, archived = ? WHERE id = ?`,
      [
        capture.type, capture.title, capture.cleanedText, capture.transcript, capture.updatedAt, capture.dueAt, capture.scheduledAt, capture.completedAt, toJson(capture.tags), capture.category,
        toJson(capture.linkedItems), toJson(capture.metadata), fromBool(capture.processed), fromBool(capture.archived), capture.id,
      ],
    );
  }

  async getById(id: string): Promise<Capture | null> {
    const row = await this.db.get<Row>('SELECT * FROM captures WHERE id = ?', [id]);
    return row ? rowToCapture(row) : null;
  }

  async listRecent(limit = 20, offset = 0): Promise<Capture[]> {
    const rows = await this.db.all<Row>('SELECT * FROM captures WHERE archived = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    return rows.map(rowToCapture);
  }

  async listUnprocessed(limit = 50): Promise<Capture[]> {
    const rows = await this.db.all<Row>('SELECT * FROM captures WHERE processed = 0 AND archived = 0 ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToCapture);
  }

  async countUnprocessed(): Promise<number> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM captures WHERE processed = 0 AND archived = 0');
    return Number(row?.n ?? 0);
  }

  async listByType(type: ItemType, limit = 50): Promise<Capture[]> {
    const rows = await this.db.all<Row>('SELECT * FROM captures WHERE type = ? AND archived = 0 ORDER BY created_at DESC LIMIT ?', [type, limit]);
    return rows.map(rowToCapture);
  }

  async listBetween(fromISO: string, toISO: string): Promise<Capture[]> {
    const rows = await this.db.all<Row>('SELECT * FROM captures WHERE created_at >= ? AND created_at < ? AND archived = 0 ORDER BY created_at DESC', [fromISO, toISO]);
    return rows.map(rowToCapture);
  }

  async deleteTranscript(id: string, updatedAt: string): Promise<void> {
    await this.db.run('UPDATE captures SET transcript = NULL, updated_at = ? WHERE id = ?', [updatedAt, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM captures WHERE id = ?', [id]);
  }

  async deleteAll(): Promise<void> {
    await this.db.run('DELETE FROM captures');
  }
}
