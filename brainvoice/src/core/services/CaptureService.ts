import type { Clock } from './Clock';
import type { Database } from '../db/Database';
import type { Capture, ItemRef, ItemType, OutboxItem } from '../domain/entities';
import type { Command, CommandBatch } from '../intent/schema';
import type { InputSource, Language } from '../types/common';
import { newId } from '../util/id';

/**
 * CaptureService – the Brain Inbox. Every input is stored as a capture with
 * its original transcript preserved; executed commands link the capture to
 * the item they produced.
 */
export class CaptureService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** Records the capture for an executed command and links it to the created item. */
  async recordForCommand(params: {
    batch: CommandBatch;
    command: Command;
    type: ItemType;
    title: string;
    cleanedText: string;
    item: ItemRef | null;
    category?: string | null;
    tags?: string[];
    dueAt?: string | null;
    scheduledAt?: string | null;
    metadata?: Record<string, unknown>;
    keepTranscript?: boolean;
  }): Promise<Capture> {
    const now = this.clock.nowISO();
    const capture: Capture = {
      id: newId(),
      type: params.type,
      title: params.title,
      originalText: params.batch.originalText,
      cleanedText: params.cleanedText,
      transcript: params.keepTranscript === false ? null : (params.batch.transcript ?? null),
      language: params.batch.language,
      createdAt: now,
      updatedAt: now,
      dueAt: params.dueAt ?? null,
      scheduledAt: params.scheduledAt ?? null,
      completedAt: null,
      tags: params.tags ?? [],
      category: params.category ?? null,
      source: params.batch.source,
      linkedItems: params.item ? [params.item] : [],
      metadata: { intent: params.command.intent, confidence: params.command.confidence, parser: params.command.parser, ...(params.metadata ?? {}) },
      processed: params.item !== null,
      archived: false,
      batchId: params.batch.id,
      commandId: params.command.id,
    };
    await this.db.captures.insert(capture);
    return capture;
  }

  /** Stores raw input that could not be interpreted yet (offline / AI unavailable) and queues it. */
  async recordUnprocessed(params: { text: string; transcript: string | null; source: InputSource; language: Language; reason: string }): Promise<{ capture: Capture; outbox: OutboxItem }> {
    const now = this.clock.nowISO();
    const capture: Capture = {
      id: newId(),
      type: 'VOICE_CAPTURE',
      title: params.text.slice(0, 80),
      originalText: params.text,
      cleanedText: params.text,
      transcript: params.transcript,
      language: params.language,
      createdAt: now,
      updatedAt: now,
      dueAt: null,
      scheduledAt: null,
      completedAt: null,
      tags: [],
      category: null,
      source: params.source,
      linkedItems: [],
      metadata: { queuedReason: params.reason },
      processed: false,
      archived: false,
      batchId: null,
      commandId: null,
    };
    const outbox: OutboxItem = {
      id: newId(),
      captureId: capture.id,
      text: params.text,
      transcript: params.transcript,
      language: params.language,
      source: params.source,
      attempts: 0,
      lastError: params.reason,
      createdAt: now,
      nextAttemptAt: now,
    };
    await this.db.driver.transaction(async () => {
      await this.db.captures.insert(capture);
      await this.db.outbox.insert(outbox);
    });
    return { capture, outbox };
  }

  async markProcessed(captureId: string, item: ItemRef, type: ItemType, title: string): Promise<void> {
    const capture = await this.db.captures.getById(captureId);
    if (!capture) return;
    capture.processed = true;
    capture.type = type;
    capture.title = title;
    capture.linkedItems = [...capture.linkedItems.filter((l) => l.id !== item.id), item];
    capture.updatedAt = this.clock.nowISO();
    await this.db.captures.update(capture);
  }

  listRecent(limit = 20): Promise<Capture[]> {
    return this.db.captures.listRecent(limit);
  }

  listUnprocessed(): Promise<Capture[]> {
    return this.db.captures.listUnprocessed();
  }

  countUnprocessed(): Promise<number> {
    return this.db.captures.countUnprocessed();
  }

  getById(id: string): Promise<Capture | null> {
    return this.db.captures.getById(id);
  }

  async archive(id: string): Promise<void> {
    const capture = await this.db.captures.getById(id);
    if (!capture) return;
    capture.archived = true;
    capture.updatedAt = this.clock.nowISO();
    await this.db.captures.update(capture);
  }

  async deleteTranscript(id: string): Promise<void> {
    await this.db.captures.deleteTranscript(id, this.clock.nowISO());
  }

  async delete(id: string): Promise<void> {
    await this.db.captures.delete(id);
  }
}
