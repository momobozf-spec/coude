import 'server-only'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'

/**
 * Audit log.
 *
 * For actions where "who changed this, and when" needs answering later:
 * subscription changes, admin operations, deletions.
 *
 * Metadata is a small allow-listed bag. Provider secrets, payment details,
 * customer ids and prompt text must never be written here — an audit log is a
 * long-lived table that tends to get exported.
 */

export type AuditAction =
  | 'CHECKOUT_CREATED'
  | 'CUSTOMER_PORTAL_OPENED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RECONCILED'
  | 'WEBHOOK_REJECTED'
  // Privacy. These are the entries that prove a member's request was honoured,
  // which is why `AuditLog` is retained through deletion rather than erased.
  | 'DATA_EXPORTED'
  | 'ACTIVITY_DELETED'
  | 'ACCOUNT_DELETION_REQUESTED'
  | 'ACCOUNT_DELETION_CANCELLED'
  | 'ACCOUNT_DELETED'
  | 'NOTIFICATION_PREFERENCES_UPDATED'
  // Account security.
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  // Admin. Reading the operations panel is itself worth recording.
  | 'ADMIN_METRICS_VIEWED'
  | 'ADMIN_RECONCILE_RUN'

type SafeMetadata = Record<string, string | number | boolean | null>

export interface AuditInput {
  actorId?: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  metadata?: SafeMetadata
  ip?: string | null
  userAgent?: string | null
}

/** Never throws — a failed audit write must not fail the operation it describes. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    logger.warn('audit.write.failed', { action: input.action, error: String(error) })
  }
}
