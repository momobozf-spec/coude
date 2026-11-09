'use server'

/**
 * Server actions voor het traject.
 *
 * De keten is altijd: UI → action → service → repository. Een action doet drie
 * dingen en niets meer: de gebruiker uit de sessie halen, de invoer valideren,
 * en de service aanroepen. Geen Prisma-query, geen businesslogica.
 *
 * Waarom server actions en geen API-routes voor deze mutaties? Omdat de UI ze
 * vanuit een formulier aanroept en Next dan zelf CSRF-bescherming en revalidatie
 * regelt. De REST-endpoints blijven bestaan voor programmatische toegang; beide
 * gaan door dezelfde service, dus er is één plek met logica.
 */
import { revalidatePath } from 'next/cache'
import { JourneyStage, TaskStatus } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import * as service from './service'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

/**
 * Zet een fout om in iets dat de UI kan tonen.
 *
 * Een `AppError` bevat een boodschap die voor de gebruiker bedoeld is. Al het
 * andere is onverwacht en wordt een generieke zin — een Prisma-fout met
 * tabelnamen hoort niet op het scherm.
 */
function toResult<T>(error: unknown): ActionResult<T> {
  if (isAppError(error)) return { ok: false, error: error.message }

  logger.error('Onverwachte fout in een journey-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.' }
}

const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TaskStatus),
})

/**
 * Zet de status van een taak.
 *
 * De service regelt de hele keten: afhankelijkheden controleren, voortgang
 * herberekenen, fase-overgang evalueren, analytics vastleggen.
 */
export async function setTaskStatusAction(
  input: z.input<typeof taskStatusSchema>,
): Promise<ActionResult<{ progress: number; unlockedTaskIds: string[]; advanced: boolean }>> {
  try {
    const userId = await requireUserId()
    const { taskId, status } = taskStatusSchema.parse(input)

    const result = await service.setTaskStatus(userId, taskId, status)

    // Beide paden verversen: het dashboard toont voortgang en aanbevelingen,
    // de trajectpagina de taken zelf.
    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return {
      ok: true,
      data: {
        progress: result.progress,
        unlockedTaskIds: result.unlockedTaskIds,
        advanced: result.stage.advanced,
      },
    }
  } catch (error) {
    return toResult(error)
  }
}

const stageSchema = z.object({
  journeyId: z.string().min(1),
  stage: z.enum(JourneyStage),
})

/**
 * Verplaatst een traject handmatig naar een andere fase.
 *
 * Vooruit kan normaal automatisch via `evaluateJourneyStage`; deze action is er
 * vooral om terug te gaan wanneer een bod afketst of een financiering niet
 * doorgaat. Dat is een normale gebeurtenis, geen fout.
 */
export async function changeStageAction(
  input: z.input<typeof stageSchema>,
): Promise<ActionResult<{ progress: number }>> {
  try {
    const userId = await requireUserId()
    const { journeyId, stage } = stageSchema.parse(input)

    const result = await service.changeStage(userId, journeyId, stage)

    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return { ok: true, data: { progress: result.progress } }
  } catch (error) {
    return toResult(error)
  }
}

const journeyIdSchema = z.object({ journeyId: z.string().min(1) })

/** Controleert of het traject naar de volgende fase kan en doet dat zo nodig. */
export async function evaluateStageAction(
  input: z.input<typeof journeyIdSchema>,
): Promise<ActionResult<{ advanced: boolean; currentStage: JourneyStage; reason: string | null }>> {
  try {
    const userId = await requireUserId()
    const { journeyId } = journeyIdSchema.parse(input)

    const result = await service.evaluateJourneyStage(userId, journeyId)

    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return {
      ok: true,
      data: {
        advanced: result.advanced,
        currentStage: result.currentStage,
        reason: result.reason,
      },
    }
  } catch (error) {
    return toResult(error)
  }
}
