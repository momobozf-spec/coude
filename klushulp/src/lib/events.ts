import "server-only";
import type { Db } from "@/db";
import { event } from "@/db/schema";

export async function logEvent(
  tx: Db | Parameters<Parameters<Db["transaction"]>[0]>[0],
  e: { entityType: string; entityId: string; type: string; actorRole?: string | null; actorUserId?: string | null; payload?: Record<string, unknown> },
) {
  await tx.insert(event).values({
    entityType: e.entityType,
    entityId: e.entityId,
    type: e.type,
    actorRole: e.actorRole ?? null,
    actorUserId: e.actorUserId ?? null,
    payload: e.payload ?? {},
  });
}
