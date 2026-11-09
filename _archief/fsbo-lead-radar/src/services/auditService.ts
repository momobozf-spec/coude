/**
 * Auditlogging voor handelingen die iemand later moet kunnen navertellen.
 *
 * Wat hier wél in hoort: inloggen, een bron aan- of uitzetten, een abonnement
 * wijzigen, gegevens wissen. Wat er niet in hoort: elke binnengekomen
 * advertentie — dat is `ListingHistory`, en het verschil is dat dit over
 * *actoren* gaat en die over *data*.
 *
 * De schrijffunctie gooit met opzet niet. Een auditregel die niet weggeschreven
 * kan worden mag geen verwijderverzoek laten mislukken; het falen wordt gelogd.
 */
import { toJsonInput } from '@/lib/json'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/repositories/prisma'

const logger = createLogger({ component: 'audit' })

export interface AuditEntry {
  /** Wie: "admin", "system:scheduler", "system:retention". */
  actor: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ip?: string
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: toJsonInput(entry.metadata),
        ip: entry.ip ?? null,
      },
    })
  } catch (error) {
    logger.error('Auditregel kon niet weggeschreven worden', {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function recentAuditEntries(limit = 50): Promise<
  { id: string; actor: string; action: string; entityType: string | null; entityId: string | null; createdAt: Date }[]
> {
  return prisma.auditLog.findMany({
    select: { id: true, actor: true, action: true, entityType: true, entityId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
