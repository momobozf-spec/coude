import { Prisma } from '@prisma/client';
import type {
  Activity,
  ActivityAction,
  EntityType,
  UserId,
  WorkspaceId,
} from '@orbit/types';
import { ulid } from '@orbit/utils';
import type { Transactional } from '../client';

/**
 * De activiteitenfeed en het audit log zijn hetzelfde ding.
 *
 * Eén tabel voor beide: als je toch elke mutatie moet vastleggen voor de
 * beveiliging, kun je die registratie net zo goed aan de gebruiker tonen ("wat
 * is er met mijn notitie gebeurd"). Dat scheelt een tweede schrijfpad dat uit
 * de pas kan gaan lopen.
 */

export interface RecordActivityInput {
  workspaceId: WorkspaceId;
  actorId: UserId | null;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  payload?: Record<string, unknown> | null;
}

function toJsonInput(payload: Record<string, unknown> | null | undefined) {
  if (payload === undefined || payload === null) return Prisma.JsonNull;
  return payload as Prisma.InputJsonObject;
}

export async function recordActivity(
  db: Transactional,
  input: RecordActivityInput,
): Promise<void> {
  await db.activity.create({
    data: {
      id: ulid(),
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: toJsonInput(input.payload),
    },
  });
}

/** Meerdere gebeurtenissen in één insert; gebruikt door bulk-acties en sync. */
export async function recordActivities(
  db: Transactional,
  entries: RecordActivityInput[],
): Promise<void> {
  if (entries.length === 0) return;
  await db.activity.createMany({
    data: entries.map((entry) => ({
      id: ulid(),
      workspaceId: entry.workspaceId,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      payload: toJsonInput(entry.payload),
    })),
  });
}

export async function listActivity(
  db: Transactional,
  workspaceId: WorkspaceId,
  options: { entityId?: string; limit?: number } = {},
): Promise<Activity[]> {
  const rows = await db.activity.findMany({
    where: { workspaceId, ...(options.entityId ? { entityId: options.entityId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(options.limit ?? 50, 200),
  });

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    actorId: row.actorId,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
