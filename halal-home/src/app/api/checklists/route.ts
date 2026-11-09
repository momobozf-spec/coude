import { NextResponse } from 'next/server'
import { ChecklistScope, JourneyStage } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { getChecklists, setChecklistItemState } from '@/modules/checklist/service'
import { findActiveJourney } from '@/modules/journey/repository'
import { withErrorHandling } from '@/server/api/handler'
import { NotFoundError } from '@/lib/errors'

/**
 * /api/checklists?journeyId=…&stage=…&scope=…
 *
 * Zonder `journeyId` valt hij terug op het actieve traject van de gebruiker.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const journeyId =
    params.get('journeyId') ?? (await findActiveJourney(userId).then((j) => j?.id ?? null))
  if (!journeyId) throw new NotFoundError('Geen actief traject gevonden')

  const stage = params.get('stage')
  const scope = params.get('scope')

  const checklists = await getChecklists(userId, journeyId, {
    stage:
      stage && (Object.values(JourneyStage) as string[]).includes(stage)
        ? (stage as JourneyStage)
        : undefined,
    scope:
      scope && (Object.values(ChecklistScope) as string[]).includes(scope)
        ? (scope as ChecklistScope)
        : undefined,
  })

  return NextResponse.json({ checklists })
})

const patchSchema = z.object({
  journeyId: z.string().min(1),
  /** De stabiele sleutel van het template-item, niet het voortgangs-id. */
  itemKey: z.string().min(1).max(120),
  action: z.enum(['complete', 'reopen', 'not_applicable']),
})

export const PATCH = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = patchSchema.parse(await request.json())

  const result = await setChecklistItemState(
    userId,
    input.journeyId,
    input.itemKey,
    input.action,
  )

  return NextResponse.json({ item: result })
})
