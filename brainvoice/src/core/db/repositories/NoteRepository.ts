import { fromBool, nullable, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../SqlDriver';
import type { Note, NoteType } from '../../domain/entities';

type Row = Record<string, SqlValue>;

function rowToNote(r: Row): Note {
  return {
    id: String(r.id),
    captureId: nullable(r.capture_id),
    type: String(r.type) as NoteType,
    title: String(r.title),
    content: String(r.content),
    category: nullable(r.category),
    folder: nullable(r.folder),
    tags: parseJson<string[]>(r.tags_json, []),
    people: parseJson<string[]>(r.people_json, []),
    favorite: toBool(r.favorite),
    archived: toBool(r.archived),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface NoteFilter {
  type?: NoteType | NoteType[];
  category?: string | null;
  folder?: string | null;
  favorite?: boolean;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export class NoteRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(note: Note): Promise<void> {
    await this.db.run(
      `INSERT INTO notes (id, capture_id, type, title, content, category, folder, tags_json, people_json, favorite, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [note.id, note.captureId, note.type, note.title, note.content, note.category, note.folder, toJson(note.tags), toJson(note.people), fromBool(note.favorite), fromBool(note.archived), note.createdAt, note.updatedAt],
    );
  }

  async update(note: Note): Promise<void> {
    await this.db.run(
      `UPDATE notes SET type = ?, title = ?, content = ?, category = ?, folder = ?, tags_json = ?, people_json = ?, favorite = ?, archived = ?, updated_at = ? WHERE id = ?`,
      [note.type, note.title, note.content, note.category, note.folder, toJson(note.tags), toJson(note.people), fromBool(note.favorite), fromBool(note.archived), note.updatedAt, note.id],
    );
  }

  async getById(id: string): Promise<Note | null> {
    const row = await this.db.get<Row>('SELECT * FROM notes WHERE id = ?', [id]);
    return row ? rowToNote(row) : null;
  }

  async getByIds(ids: string[]): Promise<Note[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.all<Row>(`SELECT * FROM notes WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return rows.map(rowToNote);
  }

  async list(filter: NoteFilter = {}): Promise<Note[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    where.push('archived = ?');
    params.push(fromBool(filter.archived ?? false));
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      where.push(`type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
    if (filter.category !== undefined) {
      if (filter.category === null) where.push('category IS NULL');
      else {
        where.push('category = ?');
        params.push(filter.category);
      }
    }
    if (filter.folder !== undefined) {
      if (filter.folder === null) where.push('folder IS NULL');
      else {
        where.push('folder = ?');
        params.push(filter.folder);
      }
    }
    if (filter.favorite !== undefined) {
      where.push('favorite = ?');
      params.push(fromBool(filter.favorite));
    }
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;
    const rows = await this.db.all<Row>(`SELECT * FROM notes WHERE ${where.join(' AND ')} ORDER BY favorite DESC, updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return rows.map(rowToNote);
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM notes WHERE archived = 0');
    return Number(row?.n ?? 0);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM notes WHERE id = ?', [id]);
  }

  async listFolders(): Promise<string[]> {
    const rows = await this.db.all<{ folder: string }>('SELECT DISTINCT folder FROM notes WHERE folder IS NOT NULL ORDER BY folder');
    return rows.map((r) => String(r.folder));
  }
}
