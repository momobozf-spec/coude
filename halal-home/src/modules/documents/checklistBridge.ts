/**
 * De brug tussen documenten en de checklist.
 *
 * ─── EEN GEÜPLOAD BESTAND IS BEWIJS VAN AANWEZIGHEID, NIET VAN JUISTHEID ─────
 *
 * Dit is de kern van dit bestand. Een geüploade compromisakte bewijst dat er
 * een compromisakte in het dossier zit. Het bewijst niet dat de opschortende
 * voorwaarde deugt, dat de termijnen kloppen, of dat de gebruiker hem gelezen
 * heeft.
 *
 * Daarom vinken we alleen items af die vragen om het AANLEVEREN van een
 * document. Items die om een HANDELING of een BEOORDELING vragen, blijven open
 * tot de gebruiker ze zelf afvinkt — ook als er een bestand bij hangt.
 *
 * Het onderscheid staat in de data: een `ChecklistItem` met een
 * `documentCategory` vraagt om een document. Zonder die categorie vraagt het om
 * iets anders, en dan raken we het niet aan.
 *
 * ─── DEZELFDE DISCIPLINE ALS BIJ FINANCIERING ────────────────────────────────
 *
 * `NEVER_AUTO_COMPLETED` is de expliciete tegenlijst, net als
 * `NEVER_SYSTEM_COMPLETABLE` in de financieringsmodule. Zonder zo'n lijst is
 * "we doen het gewoon niet" een afspraak die de eerste refactor niet overleeft.
 */
import 'server-only'
import { DocumentStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import { countsAsPresent } from './domain/lifecycle'

/**
 * Checklist-items die NOOIT automatisch afgevinkt worden, ook niet wanneer er
 * een document aan hangt.
 *
 * Allemaal om dezelfde reden: ze vragen om lezen, controleren of beoordelen.
 * Dat gebeurt in het hoofd van de gebruiker of bij zijn notaris, en een
 * bestand in de kluis zegt daar niets over.
 */
export const NEVER_AUTO_COMPLETED: readonly string[] = [
  // Vraagt om het compromis te lézen, niet om het te bezitten.
  'notary.title_deed',
  'notary.urban_info',
  'notary.soil_certificate',
  'notary.electrical_inspection',
  'notary.fuel_tank',
  'notary.syndic_documents',
  // Handelingen, geen documenten.
  'notary.utilities_transfer',
  'notary.address_change',
  'notary.insurance_active',
]

export interface LinkResult {
  linked: boolean
  autoCompleted: boolean
  /** Waarom er niet automatisch afgevinkt is. Null wanneer dat wél gebeurde. */
  reason: string | null
}

/**
 * Koppelt een document aan een checklist-item.
 *
 * Vinkt het item alleen af wanneer:
 *   1. het item om een document van deze categorie vráágt;
 *   2. het niet op de tegenlijst staat;
 *   3. het document werkelijk beschikbaar is (niet PENDING of FAILED).
 *
 * Alle drie de voorwaarden zijn objectief controleerbaar. Voor al het andere
 * blijft het item open, met de koppeling zichtbaar — zodat de gebruiker ziet
 * dát het bestand er is en zelf beslist of de taak af is.
 */
export async function linkDocumentToChecklistItem(
  userId: string,
  journeyId: string,
  documentId: string,
  itemKey: string,
): Promise<LinkResult> {
  // Eigendomscheck op beide kanten, in één keer.
  const [document, journey, item] = await Promise.all([
    prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true, status: true, category: true },
    }),
    prisma.homeBuyingJourney.findFirst({
      where: { id: journeyId, userId },
      select: { id: true },
    }),
    prisma.checklistItem.findFirst({
      where: { key: itemKey },
      select: { id: true, key: true, documentCategory: true, title: true },
    }),
  ])

  if (!document || !journey || !item) {
    return { linked: false, autoCompleted: false, reason: 'Niet gevonden.' }
  }

  const shouldComplete = mayAutoComplete(item, document)

  await prisma.userChecklistItem.upsert({
    where: { journeyId_itemId: { journeyId, itemId: item.id } },
    create: {
      userId,
      journeyId,
      itemId: item.id,
      documentId,
      completed: shouldComplete.allowed,
      completedAt: shouldComplete.allowed ? new Date() : null,
    },
    update: {
      documentId,
      // Een al afgevinkt item niet terugzetten; een open item alleen afvinken
      // wanneer het mag.
      ...(shouldComplete.allowed ? { completed: true, completedAt: new Date() } : {}),
    },
  })

  return {
    linked: true,
    autoCompleted: shouldComplete.allowed,
    reason: shouldComplete.allowed ? null : shouldComplete.reason,
  }
}

interface AutoCompleteDecision {
  allowed: boolean
  reason: string
}

/**
 * Mag dit item automatisch afgevinkt worden?
 *
 * Exported zodat een test hem los kan vastpinnen — dit is de regel waar het om
 * draait.
 */
export function mayAutoComplete(
  item: { key: string; documentCategory: string | null },
  document: { status: DocumentStatus; category: string },
): AutoCompleteDecision {
  if (NEVER_AUTO_COMPLETED.includes(item.key)) {
    return {
      allowed: false,
      reason:
        'Dit onderdeel vraagt om iets na te kijken of te regelen, niet alleen om een bestand. Vink het zelf af wanneer je het gecontroleerd hebt.',
    }
  }

  if (item.documentCategory === null) {
    return {
      allowed: false,
      reason: 'Dit onderdeel vraagt niet om een document.',
    }
  }

  if (!countsAsPresent(document.status)) {
    return {
      allowed: false,
      reason: 'Het document is nog niet beschikbaar.',
    }
  }

  if (item.documentCategory !== document.category) {
    return {
      allowed: false,
      reason: `Dit onderdeel vraagt om een document uit de categorie ${item.documentCategory}.`,
    }
  }

  return { allowed: true, reason: '' }
}

/**
 * Werkt de checklist bij na een upload.
 *
 * Zoekt items die om déze documentcategorie vragen en nog open staan. Alleen
 * wanneer er precies één kandidaat is, koppelen we automatisch: bij meerdere
 * kandidaten weten we niet welke de gebruiker bedoelde, en gokken is erger dan
 * hem laten kiezen.
 */
export async function syncChecklistAfterUpload(
  userId: string,
  journeyId: string,
  documentId: string,
): Promise<LinkResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, category: true, status: true, checklistItemKey: true },
  })

  if (!document || !countsAsPresent(document.status)) {
    return { linked: false, autoCompleted: false, reason: 'Document niet beschikbaar.' }
  }

  // Heeft de gebruiker zelf een item aangewezen? Dan is er niets te raden.
  if (document.checklistItemKey) {
    return linkDocumentToChecklistItem(
      userId,
      journeyId,
      documentId,
      document.checklistItemKey,
    )
  }

  const candidates = await prisma.userChecklistItem.findMany({
    where: {
      userId,
      journeyId,
      completed: false,
      notApplicable: false,
      documentId: null,
      item: { documentCategory: document.category },
    },
    select: { item: { select: { key: true, documentCategory: true } } },
  })

  const eligible = candidates.filter(
    (c) => mayAutoComplete(c.item, document).allowed,
  )

  if (eligible.length !== 1) {
    logger.debug('Geen eenduidig checklist-item voor deze upload', {
      documentCount: eligible.length,
      category: document.category,
    })
    return {
      linked: false,
      autoCompleted: false,
      reason:
        eligible.length === 0
          ? 'Geen openstaand checklist-item dat om dit soort document vraagt.'
          : 'Meerdere checklist-items vragen om dit soort document. Kies zelf welk je bedoelt.',
    }
  }

  return linkDocumentToChecklistItem(
    userId,
    journeyId,
    documentId,
    eligible[0]!.item.key,
  )
}
