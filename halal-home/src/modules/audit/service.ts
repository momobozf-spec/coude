/**
 * Audit logging voor gevoelige acties.
 *
 * WAT ER NOOIT IN MAG: documentinhoud, bestandsnamen die de gebruiker koos,
 * e-mailadressen, wachtwoorden, tokens, storage keys. Een audit log die zelf
 * gevoelige gegevens bevat verplaatst het probleem in plaats van het op te
 * lossen — en logs worden doorgaans minder streng bewaakt dan de tabel waar het
 * over gaat.
 *
 * Wat er wél in gaat: wie, welke actie, welk type entiteit, welk id, en
 * niet-gevoelige context zoals een statuswijziging of een bestandsgrootte.
 */
import 'server-only'
import { createHash } from 'node:crypto'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'

/** De acties die we vastleggen. Als union zodat een typfout niet compileert. */
export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_LOGIN_FAILED'
  | 'JOURNEY_CREATED'
  | 'JOURNEY_STAGE_CHANGED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_LINKED'
  | 'DOCUMENT_UNLINKED'
  | 'DOCUMENT_EXPLANATION_REQUESTED'
  | 'DOCUMENT_EXPLANATION_CREATED'
  | 'NOTARY_CHECKLIST_OPENED'
  | 'FINANCING_QUOTE_CREATED'
  | 'SEARCH_CREATED'
  | 'SEARCH_DELETED'
  | 'NEIGHBORHOOD_PREFERENCES_UPDATED'

export interface AuditInput {
  userId: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  metadata?: Record<string, string | number | boolean | null>
  /** Ruw IP; wordt gehasht opgeslagen, nooit in leesbare vorm. */
  ip?: string | null
  userAgent?: string | null
}

/**
 * IP-adressen zijn persoonsgegevens. We willen kunnen zien dát twee acties van
 * hetzelfde adres komen zonder het adres zelf te bewaren, dus slaan we een hash
 * op. De salt komt uit AUTH_SECRET, zodat een gestolen logtabel zonder die
 * sleutel geen rainbow-table-aanval toelaat op de beperkte IPv4-ruimte.
 */
function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${process.env.AUTH_SECRET ?? ''}:${ip}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Schrijft een auditregel.
 *
 * Faalt nooit hard: een mislukte audit mag geen upload afbreken die verder
 * gelukt is. De fout wordt wel gelogd, want een stil wegvallende audittrail is
 * op termijn een groter probleem dan één mislukte schrijfactie.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ipHash: input.ip ? hashIp(input.ip) : null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    })
  } catch (error) {
    logger.error('Audit log kon niet worden geschreven', {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : 'onbekend',
    })
  }
}

/** De audittrail van één gebruiker. Alleen zijn eigen regels. */
export async function listAuditLog(userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
