import 'server-only'

import type { AuditAction, Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'

/**
 * Audit trail for financially meaningful changes (§45).
 *
 * What goes in: who, what action, which record, when. What stays out: amounts,
 * balances, account numbers — the row itself already holds those, and an audit
 * table is a second place they could leak from (§47).
 */

export interface AuditEntry {
  userId: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  /** Non-financial context only, e.g. `{ from: 'DRAFT', to: 'FINALIZED' }`. */
  metadata?: Prisma.InputJsonValue
}

/**
 * Record an audit entry.
 *
 * Never throws: a failed audit write must not roll back the user's action. It is
 * logged at error level so the gap is visible in monitoring.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
      },
    })
  } catch (error) {
    logger.error('audit.write_failed', {
      action: entry.action,
      entityType: entry.entityType,
      message: error instanceof Error ? error.message : 'unknown',
    })
  }
}

/**
 * Audit inside an existing transaction, so the log and the change commit or fail
 * together. Use for state transitions that must not be silently unlogged, such as
 * finalising a calculation.
 */
export function auditWithin(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<unknown> {
  return tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  })
}
