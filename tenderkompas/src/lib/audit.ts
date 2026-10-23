import type { DB } from "@/db";
import { auditLog } from "@/db/schema";

/** Auditlog zonder documentinhoud of onnodige persoonsgegevens. */
export async function audit(
  database: Pick<DB, "insert">,
  entry: {
    actorUserId?: string | null;
    organizationId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await database.insert(auditLog).values({
    actorUserId: entry.actorUserId ?? null,
    organizationId: entry.organizationId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
  });
}
