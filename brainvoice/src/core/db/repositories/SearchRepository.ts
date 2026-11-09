import type { SqlExecutor, SqlValue } from '../SqlDriver';
import type { ItemType } from '../../domain/entities';
import { tokenize } from '../../util/text';

/**
 * Full-text index over notes, tasks and captures.
 * Uses FTS5 when available (expo-sqlite ships it; node:sqlite too) and falls
 * back to a LIKE search over a plain table otherwise. Semantic search can be
 * layered on later through `EmbeddingProvider` (see search/EmbeddingProvider.ts).
 */

export interface SearchDocument {
  itemId: string;
  itemType: ItemType;
  title: string;
  content: string;
  tags: string[];
  people: string[];
}

export interface SearchHit {
  itemId: string;
  itemType: ItemType;
  rank: number;
  snippet: string | null;
}

export interface SearchQueryOptions {
  types?: ItemType[];
  limit?: number;
}

function ftsQuery(query: string): string | null {
  const tokens = tokenize(query).filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  // Every token must match as a prefix; quotes keep punctuation-safe.
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
}

export class SearchRepository {
  constructor(
    private readonly db: SqlExecutor,
    private readonly fts5: boolean,
  ) {}

  get usesFts5(): boolean {
    return this.fts5;
  }

  async index(doc: SearchDocument): Promise<void> {
    await this.remove(doc.itemId);
    const table = this.fts5 ? 'search_index' : 'search_index_plain';
    await this.db.run(`INSERT INTO ${table} (item_id, item_type, title, content, tags, people) VALUES (?, ?, ?, ?, ?, ?)`, [doc.itemId, doc.itemType, doc.title, doc.content, doc.tags.join(' '), doc.people.join(' ')]);
  }

  async remove(itemId: string): Promise<void> {
    const table = this.fts5 ? 'search_index' : 'search_index_plain';
    await this.db.run(`DELETE FROM ${table} WHERE item_id = ?`, [itemId]);
  }

  async search(query: string, options: SearchQueryOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit ?? 50;
    const typeFilter = options.types && options.types.length > 0 ? options.types : null;
    if (this.fts5) {
      const match = ftsQuery(query);
      if (!match) return [];
      const params: SqlValue[] = [match];
      let where = 'search_index MATCH ?';
      if (typeFilter) {
        where += ` AND item_type IN (${typeFilter.map(() => '?').join(',')})`;
        params.push(...typeFilter);
      }
      params.push(limit);
      const rows = await this.db.all<{ item_id: string; item_type: string; rank: number; snippet: string }>(
        `SELECT item_id, item_type, bm25(search_index, 0, 0, 10.0, 5.0, 3.0, 4.0) AS rank, snippet(search_index, 3, '[', ']', '…', 12) AS snippet FROM search_index WHERE ${where} ORDER BY rank LIMIT ?`,
        params,
      );
      return rows.map((r) => ({ itemId: String(r.item_id), itemType: String(r.item_type) as ItemType, rank: Number(r.rank), snippet: r.snippet ? String(r.snippet) : null }));
    }
    const tokens = tokenize(query).filter((t) => t.length > 1);
    if (tokens.length === 0) return [];
    const params: SqlValue[] = [];
    const clauses = tokens.map((t) => {
      params.push(`%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`);
      return '(lower(title) LIKE ? OR lower(content) LIKE ? OR lower(tags) LIKE ? OR lower(people) LIKE ?)';
    });
    let where = clauses.join(' AND ');
    if (typeFilter) {
      where += ` AND item_type IN (${typeFilter.map(() => '?').join(',')})`;
      params.push(...typeFilter);
    }
    params.push(limit);
    const rows = await this.db.all<{ item_id: string; item_type: string; content: string }>(`SELECT item_id, item_type, content FROM search_index_plain WHERE ${where} LIMIT ?`, params);
    return rows.map((r, i) => ({ itemId: String(r.item_id), itemType: String(r.item_type) as ItemType, rank: i, snippet: String(r.content).slice(0, 120) }));
  }

  async clear(): Promise<void> {
    await this.db.run(`DELETE FROM ${this.fts5 ? 'search_index' : 'search_index_plain'}`);
  }
}
