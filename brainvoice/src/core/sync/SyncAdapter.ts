import type { ItemType } from '../domain/entities';

/**
 * Optional cloud synchronisation. Not implemented in v1 (local-first, ADR §1).
 * The shape is fixed now so that a later implementation does not touch the
 * domain services: they emit change records, the adapter pushes/pulls them.
 */

export interface ChangeRecord {
  id: string;
  itemType: ItemType | 'CATEGORY' | 'TAG' | 'SETTING';
  itemId: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown> | null;
  changedAt: string;
}

export interface SyncStatus {
  lastPushAt: string | null;
  lastPullAt: string | null;
  pendingChanges: number;
  error: string | null;
}

export interface SyncAdapter {
  readonly id: string;
  isConfigured(): Promise<boolean>;
  push(changes: ChangeRecord[]): Promise<{ accepted: string[]; rejected: { id: string; reason: string }[] }>;
  pull(since: string | null): Promise<{ changes: ChangeRecord[]; cursor: string | null }>;
  status(): Promise<SyncStatus>;
}

export class NoopSyncAdapter implements SyncAdapter {
  readonly id = 'none';
  async isConfigured(): Promise<boolean> {
    return false;
  }
  async push(changes: ChangeRecord[]): Promise<{ accepted: string[]; rejected: { id: string; reason: string }[] }> {
    return { accepted: [], rejected: changes.map((c) => ({ id: c.id, reason: 'sync disabled' })) };
  }
  async pull(): Promise<{ changes: ChangeRecord[]; cursor: string | null }> {
    return { changes: [], cursor: null };
  }
  async status(): Promise<SyncStatus> {
    return { lastPushAt: null, lastPullAt: null, pendingChanges: 0, error: null };
  }
}
