import 'server-only'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'
import { verifyPassword } from '@/server/auth/password'
import { getFileStorage } from '@/server/storage'
import { recordAudit } from '@/server/services/audit'

/**
 * AVG/GDPR: inzage (art. 15/20) en wissen (art. 17).
 *
 * De export bevat alles wat aan de gebruiker hangt, behalve geheimen
 * (wachtwoordhash, OAuth-tokens, sessietokens) en de inhoud van geüploade
 * bestanden — die zijn via de app zelf te downloaden; de export vermeldt ze.
 */
export async function exportPersonalData(actor: Actor): Promise<Record<string, unknown>> {
  const userId = actor.userId

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      role: true,
      locale: true,
      timezone: true,
      onboardedAt: true,
      specialDataConsentAt: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
      accounts: { select: { provider: true, type: true } },
      zakatProfile: true,
      subscription: true,
      notificationPreference: true,
      assets: true,
      liabilities: true,
      calculations: { include: { items: true, rates: true } },
      donations: true,
      documents: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
      favoriteCharities: true,
      sadaqahGoals: true,
      reminders: true,
      notifications: true,
      annualReports: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
      ownedHouseholds: true,
      householdMemberships: true,
    },
  })

  await recordAudit({
    userId,
    action: 'DATA_EXPORTED',
    entityType: 'User',
    entityId: userId,
  })

  return {
    exportedAt: new Date().toISOString(),
    format: 'barakah-export-v1',
    note: 'Bedragen staan als decimale tekst, datums in UTC (ISO 8601). Geüploade bestanden zelf zitten niet in deze export.',
    data: user,
  }
}

/**
 * Account definitief wissen.
 *
 * Alle eigen rijen gaan mee via `onDelete: Cascade`; in een huishouden blijven
 * de gegevens van de andere leden staan (`SetNull`). Auditregels blijven
 * zonder koppeling aan de persoon bestaan. Bestanden worden na de commit uit
 * de opslag verwijderd; een mislukte bestandsverwijdering wordt gelogd met de
 * sleutel, zodat ze met de hand op te ruimen is.
 */
export async function deleteAccount(actor: Actor, confirmation: { email: string; password?: string }): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { email: true, passwordHash: true },
  })
  if (!user) return

  if (confirmation.email.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new ValidationError('Typ je eigen e-mailadres ter bevestiging.', {
      email: ['Typ je eigen e-mailadres ter bevestiging.'],
    })
  }

  if (user.passwordHash) {
    const valid = await verifyPassword(confirmation.password ?? '', user.passwordHash)
    if (!valid) {
      throw new ValidationError('Je wachtwoord klopt niet.', { password: ['Je wachtwoord klopt niet.'] })
    }
  }

  // Een huishouden met andere leden verdwijnt mee met zijn eigenaar (Cascade).
  // Dat mag niet stilzwijgend gebeuren voor de andere leden.
  const sharedHousehold = await prisma.household.findFirst({
    where: { ownerUserId: actor.userId, members: { some: { userId: { not: actor.userId } } } },
    select: { id: true },
  })
  if (sharedHousehold) {
    throw new ValidationError(
      'Je beheert een huishouden met andere leden. Neem contact met ons op om het eigenaarschap over te dragen; daarna kun je je account verwijderen.',
    )
  }

  const documents = await prisma.document.findMany({
    where: { userId: actor.userId },
    select: { storageKey: true },
  })

  await prisma.user.delete({ where: { id: actor.userId } })

  await recordAudit({
    userId: null,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: actor.userId,
    metadata: { documents: documents.length },
  })

  const storage = getFileStorage()
  for (const { storageKey } of documents) {
    try {
      await storage.delete(storageKey)
    } catch (error) {
      logger.error('account.delete.file_left_behind', {
        storageKey,
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}
