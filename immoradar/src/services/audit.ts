import type { Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditInput {
  agencyId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Append-only audit trail. Never store personal data in metadata; reference ids instead. */
export async function audit(db: Db, input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: { agencyId: input.agencyId, userId: input.userId, action: input.action, entityType: input.entityType ?? null, entityId: input.entityId ?? null, metadata: input.metadata, ip: input.ip ?? null },
  });
}
