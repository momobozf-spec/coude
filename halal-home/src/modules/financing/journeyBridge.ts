/**
 * De brug tussen financiering en het aankooptraject.
 *
 * ─── WELKE TAKEN MAG HET SYSTEEM ZELF AFVINKEN? ──────────────────────────────
 *
 * Alleen taken waarvan het bewijs OBJECTIEF en CONTROLEERBAAR in de database
 * staat. De lijst hieronder is limitatief en staat op één plek, zodat er nooit
 * per ongeluk een taak bij komt.
 *
 * De grens:
 *
 *   MAG WEL   "Vergelijk financieringsvormen" — er staan twee bewaarde
 *             berekeningen voor twee verschillende producten. Dat is een feit
 *             in de database.
 *
 *   MAG NIET  "Begrijp je financiering", "Lees de voorwaarden na". Dat gebeurt
 *             in het hoofd van de gebruiker. Een systeem dat zoiets afvinkt
 *             beweert iets wat het niet kan weten, en de gebruiker verliest de
 *             enige plek waar hij zag dat hij dit nog moest doen.
 *
 * ─── WAAROM AFVINKEN EN NIET ALLEEN VOORSTELLEN ──────────────────────────────
 *
 * Een taak die aantoonbaar gedaan is maar open blijft staan, ondermijnt de
 * hele lijst: de gebruiker leert dat de vinkjes niet kloppen. Daarom vinken we
 * af waar het bewijs hard is — en nergens anders.
 */
import 'server-only'
import { TaskStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'
import { setTaskStatus } from '@/modules/journey/service'
import { getFinancingEvidence, type FinancingEvidence } from './service'

/**
 * De blauwdruktaken die het systeem zelf mag afronden, met de voorwaarde.
 *
 * `evidence` beschrijft in gewone taal waarom dit objectief is; die tekst komt
 * in de auditmetadata terecht zodat achteraf navolgbaar is waaróm er afgevinkt
 * is.
 */
export const SYSTEM_COMPLETABLE_TASKS: readonly {
  templateKey: string
  evidence: string
  isSatisfied: (evidence: FinancingEvidence) => boolean
}[] = [
  {
    templateKey: 'FINANCING_COMPARE_OPTIONS',
    evidence: 'Er zijn berekeningen bewaard voor minstens twee verschillende producten.',
    isSatisfied: (e) => e.comparedAtLeastTwo,
  },
]

/**
 * Taken die NOOIT automatisch afgerond mogen worden.
 *
 * Bestaat als expliciete lijst zodat een test hem kan bewaken. Zonder deze
 * lijst is "we doen het gewoon niet" een afspraak die de eerste de beste
 * refactor niet overleeft.
 */
export const NEVER_SYSTEM_COMPLETABLE: readonly string[] = [
  'FINANCING_DETERMINE_NEED',
  'FINANCING_CONTACT_PROVIDER',
  'FINANCING_OBTAIN_PROOF',
  'FINANCING_UPLOAD_IDENTITY',
  'FINANCING_UPLOAD_INCOME',
  'FINANCING_UPLOAD_BANK_STATEMENTS',
  'OFFER_CONFIRM_FINANCING',
  'AGREEMENT_REVIEW_CONTRACT',
]

export interface SyncResult {
  completedTaskKeys: string[]
  evidence: FinancingEvidence
}

/**
 * Werkt de trajecttaken bij op basis van wat er werkelijk in de database staat.
 *
 * Wordt aangeroepen na het bewaren van een quote. Vinkt uitsluitend taken af
 * die in `SYSTEM_COMPLETABLE_TASKS` staan én waarvan de voorwaarde klopt.
 *
 * Een taak die de gebruiker zelf op SKIPPED zette, blijft met rust: hij heeft
 * daar een bedoeling mee gehad.
 */
export async function syncFinancingTasks(
  userId: string,
  journeyId: string,
): Promise<SyncResult> {
  const evidence = await getFinancingEvidence(userId, journeyId)
  const completedTaskKeys: string[] = []

  for (const rule of SYSTEM_COMPLETABLE_TASKS) {
    if (!rule.isSatisfied(evidence)) continue

    const task = await prisma.journeyTask.findFirst({
      where: { journeyId, userId, templateKey: rule.templateKey },
      select: { id: true, status: true },
    })

    if (!task) continue
    // Alleen open taken. COMPLETED is al goed; SKIPPED was een keuze van de
    // gebruiker en die overschrijven we niet.
    if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.IN_PROGRESS) continue

    try {
      await setTaskStatus(userId, task.id, TaskStatus.COMPLETED)
      completedTaskKeys.push(rule.templateKey)
    } catch (error) {
      // Een geblokkeerde taak (afhankelijkheden nog open) is geen fout die het
      // bewaren van een quote mag terugdraaien. We loggen en gaan door.
      logger.info('Taak kon niet automatisch afgerond worden', {
        entityKey: rule.templateKey,
        error: error instanceof Error ? error.message : 'onbekend',
      })
    }
  }

  return { completedTaskKeys, evidence }
}

/**
 * Mag deze taak door het systeem afgerond worden?
 *
 * Publiek zodat de UI kan tonen dat een vinkje automatisch gezet is, en zodat
 * een test kan controleren dat de twee lijsten elkaar niet overlappen.
 */
export function isSystemCompletable(templateKey: string): boolean {
  return SYSTEM_COMPLETABLE_TASKS.some((rule) => rule.templateKey === templateKey)
}
