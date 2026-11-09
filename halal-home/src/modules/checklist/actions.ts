'use server'

/**
 * Server actions voor checklists. Zelfde keten als bij het traject:
 * UI → action → service → repository.
 */
import { revalidatePath } from 'next/cache'
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

function toResult<T>(error: unknown): ActionResult<T> {
  if (isAppError(error)) return { ok: false, error: error.message }

  logger.error('Onverwachte fout in een checklist-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.' }
}

const setStateSchema = z.object({
  journeyId: z.string().min(1),
  /** De stabiele sleutel van het template-item, niet het voortgangs-id. */
  itemKey: z.string().min(1).max(120),
  action: z.enum(['complete', 'reopen', 'not_applicable']),
})

export async function setChecklistItemAction(
  input: z.input<typeof setStateSchema>,
): Promise<ActionResult<{ completed: boolean; notApplicable: boolean }>> {
  try {
    const userId = await requireUserId()
    const parsed = setStateSchema.parse(input)

    const result = await service.setChecklistItemState(
      userId,
      parsed.journeyId,
      parsed.itemKey,
      parsed.action,
    )

    revalidatePath('/checklists')
    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return { ok: true, data: result }
  } catch (error) {
    return toResult(error)
  }
}
