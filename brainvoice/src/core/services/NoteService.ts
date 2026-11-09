import type { Clock } from './Clock';
import type { Database } from '../db/Database';
import type { NoteFilter } from '../db/repositories/NoteRepository';
import type { Note, NoteType } from '../domain/entities';
import { classifyText, suggestTitle } from '../intent/Classifier';
import { DomainError, type Language } from '../types/common';
import { newId } from '../util/id';

export interface NoteInput {
  type: NoteType;
  title?: string | null;
  content: string;
  category?: string | null;
  folder?: string | null;
  tags?: string[];
  people?: string[];
  captureId?: string | null;
  language?: Language;
}

/** Notes / second brain: our own store (Apple Notes has no public write API, ADR §8). */
export class NoteService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: NoteInput): Promise<Note> {
    const now = this.clock.nowISO();
    const content = input.content.trim();
    if (!content) throw new DomainError('VALIDATION_FAILED', 'Note content is empty');
    const auto = classifyText(content, { isIdea: input.type === 'IDEA', people: input.people });
    const note: Note = {
      id: newId(),
      captureId: input.captureId ?? null,
      type: input.type,
      title: (input.title ?? '').trim() || suggestTitle(content, input.language ?? 'en'),
      content,
      category: input.category === undefined ? (auto.category === 'Uncategorized' ? null : auto.category) : input.category,
      folder: input.folder ?? null,
      tags: Array.from(new Set([...(input.tags ?? []), ...(input.tags ? [] : auto.tags)])).slice(0, 10),
      people: input.people ?? [],
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.notes.insert(note);
    await this.index(note);
    return note;
  }

  async update(id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'category' | 'folder' | 'tags' | 'people' | 'favorite' | 'archived' | 'type'>>): Promise<Note> {
    const note = await this.db.notes.getById(id);
    if (!note) throw new DomainError('NOT_FOUND', 'Note not found');
    const next: Note = { ...note, ...patch, updatedAt: this.clock.nowISO() };
    await this.db.notes.update(next);
    await this.index(next);
    return next;
  }

  async toggleFavorite(id: string): Promise<Note> {
    const note = await this.db.notes.getById(id);
    if (!note) throw new DomainError('NOT_FOUND', 'Note not found');
    return this.update(id, { favorite: !note.favorite });
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { archived: true });
  }

  async delete(id: string): Promise<void> {
    await this.db.notes.delete(id);
    await this.db.search.remove(id);
  }

  getById(id: string): Promise<Note | null> {
    return this.db.notes.getById(id);
  }

  list(filter: NoteFilter = {}): Promise<Note[]> {
    return this.db.notes.list(filter);
  }

  count(): Promise<number> {
    return this.db.notes.count();
  }

  async link(fromId: string, toId: string, toType: string, relation = 'related'): Promise<void> {
    await this.db.driver.run('INSERT OR IGNORE INTO item_links (from_type, from_id, to_type, to_id, relation, created_at) VALUES (?, ?, ?, ?, ?, ?)', ['NOTE', fromId, toType, toId, relation, this.clock.nowISO()]);
  }

  async linkedItems(noteId: string): Promise<{ type: string; id: string; relation: string }[]> {
    const rows = await this.db.driver.all<{ to_type: string; to_id: string; relation: string }>('SELECT to_type, to_id, relation FROM item_links WHERE from_type = ? AND from_id = ?', ['NOTE', noteId]);
    return rows.map((r) => ({ type: String(r.to_type), id: String(r.to_id), relation: String(r.relation) }));
  }

  private async index(note: Note): Promise<void> {
    if (note.archived) {
      await this.db.search.remove(note.id);
      return;
    }
    await this.db.search.index({ itemId: note.id, itemType: note.type, title: note.title, content: note.content, tags: note.tags, people: note.people });
  }
}
