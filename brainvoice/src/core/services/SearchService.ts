import { DateTime } from 'luxon';

import type { Clock } from './Clock';
import type { Database } from '../db/Database';
import type { Capture, ItemType, Note, Reminder, Task } from '../domain/entities';
import type { EmbeddingProvider, VectorIndex } from '../search/EmbeddingProvider';
import { tokenize } from '../util/text';

export interface SearchFilters {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  person?: string | null;
  types?: ItemType[];
  limit?: number;
}

export interface SearchResult {
  type: ItemType;
  id: string;
  title: string;
  snippet: string;
  createdAt: string;
  dueAt: string | null;
  score: number;
  item: Note | Task | Reminder | Capture;
}

/**
 * Full-text search over notes, tasks, reminders and captures with date /
 * category / person filters. Semantic search is optional and only used when an
 * EmbeddingProvider + VectorIndex are configured (not in the MVP).
 */
export class SearchService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly semantic: { embeddings: EmbeddingProvider; index: VectorIndex } | null = null,
  ) {}

  async search(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    const limit = filters.limit ?? 30;
    const hits = await this.db.search.search(query, { types: filters.types, limit: limit * 2 });
    const byType = new Map<ItemType, string[]>();
    for (const hit of hits) {
      const list = byType.get(hit.itemType) ?? [];
      list.push(hit.itemId);
      byType.set(hit.itemType, list);
    }
    const results: SearchResult[] = [];
    const noteIds = [...(byType.get('NOTE') ?? []), ...(byType.get('IDEA') ?? []), ...(byType.get('THOUGHT') ?? []), ...(byType.get('QUESTION') ?? []), ...(byType.get('REFERENCE') ?? [])];
    const notes = await this.db.notes.getByIds(noteIds);
    for (const note of notes) results.push({ type: note.type, id: note.id, title: note.title, snippet: snippetFor(note.content, query), createdAt: note.createdAt, dueAt: null, score: rankOf(hits, note.id), item: note });
    const tasks = await this.db.tasks.getByIds(byType.get('TASK') ?? []);
    for (const task of tasks) results.push({ type: 'TASK', id: task.id, title: task.title, snippet: task.description ?? task.title, createdAt: task.createdAt, dueAt: task.dueAt ?? task.dueDate, score: rankOf(hits, task.id), item: task });
    for (const id of byType.get('REMINDER') ?? []) {
      const reminder = await this.db.reminders.getById(id);
      if (reminder) results.push({ type: 'REMINDER', id, title: reminder.title, snippet: reminder.notes ?? reminder.title, createdAt: reminder.createdAt, dueAt: reminder.dueAt, score: rankOf(hits, id), item: reminder });
    }
    for (const id of byType.get('VOICE_CAPTURE') ?? []) {
      const capture = await this.db.captures.getById(id);
      if (capture) results.push({ type: 'VOICE_CAPTURE', id, title: capture.title, snippet: snippetFor(capture.cleanedText, query), createdAt: capture.createdAt, dueAt: capture.dueAt, score: rankOf(hits, id), item: capture });
    }

    // Semantic fallback / boost when configured.
    if (this.semantic && results.length < 5) {
      try {
        const [vector] = await this.semantic.embeddings.embed([query]);
        if (vector) {
          const neighbours = await this.semantic.index.query(vector, limit);
          for (const n of neighbours) {
            if (results.some((r) => r.id === n.itemId)) continue;
            const note = await this.db.notes.getById(n.itemId);
            if (note) results.push({ type: note.type, id: note.id, title: note.title, snippet: snippetFor(note.content, query), createdAt: note.createdAt, dueAt: null, score: n.score, item: note });
          }
        }
      } catch {
        // semantic search is best-effort
      }
    }

    return results
      .filter((r) => this.passesFilters(r, filters))
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);
  }

  private passesFilters(result: SearchResult, filters: SearchFilters): boolean {
    const zone = this.clock.timezone();
    if (filters.from) {
      const from = DateTime.fromISO(filters.from, { zone }).startOf('day');
      if (DateTime.fromISO(result.createdAt) < from) return false;
    }
    if (filters.to) {
      const to = DateTime.fromISO(filters.to, { zone }).endOf('day');
      if (DateTime.fromISO(result.createdAt) > to) return false;
    }
    if (filters.category) {
      const category = 'category' in result.item ? result.item.category : null;
      if ((category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
    }
    if (filters.person) {
      const people = 'people' in result.item ? result.item.people : [];
      const person = filters.person.toLowerCase();
      const haystack = `${result.title} ${result.snippet} ${people.join(' ')}`.toLowerCase();
      if (!haystack.includes(person)) return false;
    }
    return true;
  }
}

function rankOf(hits: { itemId: string; rank: number }[], id: string): number {
  return hits.find((h) => h.itemId === id)?.rank ?? 0;
}

function snippetFor(content: string, query: string, width = 140): string {
  const tokens = tokenize(query);
  const lower = content.toLowerCase();
  let index = -1;
  for (const t of tokens) {
    index = lower.indexOf(t);
    if (index >= 0) break;
  }
  if (index < 0) return content.length > width ? `${content.slice(0, width - 1)}…` : content;
  const start = Math.max(0, index - Math.floor(width / 3));
  const end = Math.min(content.length, start + width);
  return `${start > 0 ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`;
}
