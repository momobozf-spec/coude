import type { DeviceId, IsoDateTime, OperationId, ServerSeq, WorkspaceId } from './ids';

/** De tabellen die meedoen aan de delta-sync. */
export const SyncEntity = {
  Item: 'item',
  ChecklistItem: 'checklistItem',
  Project: 'project',
  Tag: 'tag',
  ItemTag: 'itemTag',
  Reminder: 'reminder',
  Attachment: 'attachment',
  ItemLink: 'itemLink',
  NoteFolder: 'noteFolder',
} as const;
export type SyncEntity = (typeof SyncEntity)[keyof typeof SyncEntity];

export const SYNC_ENTITIES: readonly SyncEntity[] = Object.values(SyncEntity);

export const OperationKind = {
  Create: 'CREATE',
  Patch: 'PATCH',
  Delete: 'DELETE',
  Restore: 'RESTORE',
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

/**
 * De eenheid van offline werk. Bewust een *patch* en niet het hele object:
 * alleen gewijzigde velden reizen mee, waardoor de server per veld kan bepalen
 * wie wint bij een conflict.
 */
export interface SyncOperation {
  operationId: OperationId;
  entity: SyncEntity;
  entityId: string;
  kind: OperationKind;
  /** Alleen de gewijzigde velden. Bij CREATE de volledige rij. */
  payload: Record<string, unknown>;
  /** Wanneer de gebruiker de wijziging maakte (device-klok, kan scheef staan). */
  clientTs: IsoDateTime;
  /** Volgnummer binnen deze client; bewaart de volgorde binnen één device. */
  clientSeq: number;
}

export interface PushRequest {
  deviceId: DeviceId;
  workspaceId: WorkspaceId;
  operations: SyncOperation[];
  /** De cursor die de client nu heeft; de server kan meteen laten weten of hij achterloopt. */
  lastKnownSeq: ServerSeq;
}

export const OperationOutcome = {
  Applied: 'APPLIED',
  /** Deze operationId was al verwerkt; genegeerd (idempotentie). */
  Duplicate: 'DUPLICATE',
  /** Toegepast, maar de server had nieuwere waarden voor sommige velden. */
  Merged: 'MERGED',
  /** Geweigerd: de rij bestaat niet meer of de gebruiker mag er niet bij. */
  Rejected: 'REJECTED',
  /** Validatiefout; de client moet de operatie laten vallen en de fout tonen. */
  Invalid: 'INVALID',
} as const;
export type OperationOutcome = (typeof OperationOutcome)[keyof typeof OperationOutcome];

export interface OperationResult {
  operationId: OperationId;
  outcome: OperationOutcome;
  /** Bij MERGED/REJECTED: de gezaghebbende serverwaarden die de client moet overnemen. */
  serverState?: Record<string, unknown>;
  /** Welke velden de server heeft laten winnen. */
  conflictedFields?: string[];
  reason?: string;
}

export interface PushResponse {
  results: OperationResult[];
  /** De hoogste serverSeq na deze push; de client kan hierop verder pullen. */
  serverSeq: ServerSeq;
}

export interface PullRequest {
  workspaceId: WorkspaceId;
  since: ServerSeq;
  limit?: number;
  /** Beperk tot bepaalde tabellen; standaard alles. */
  entities?: SyncEntity[];
}

export interface ChangeSet {
  /** Per tabel de gewijzigde rijen, inclusief tombstones (`deletedAt` gevuld). */
  changes: Partial<Record<SyncEntity, Record<string, unknown>[]>>;
  /** Nieuwe cursor. */
  serverSeq: ServerSeq;
  /** Er is meer; roep direct nog eens aan. */
  hasMore: boolean;
}

/** Wat er over het SSE-kanaal komt. */
export interface ChangeEvent {
  workspaceId: WorkspaceId;
  serverSeq: ServerSeq;
  /** Het device dat de wijziging veroorzaakte; de bron negeert zijn eigen echo. */
  originDeviceId: DeviceId | null;
  entities: SyncEntity[];
}

export const SyncState = {
  Idle: 'IDLE',
  Syncing: 'SYNCING',
  Offline: 'OFFLINE',
  Error: 'ERROR',
} as const;
export type SyncState = (typeof SyncState)[keyof typeof SyncState];

export interface SyncStatus {
  state: SyncState;
  pendingOperations: number;
  lastSyncedAt: IsoDateTime | null;
  lastError: string | null;
  cursor: ServerSeq;
}
