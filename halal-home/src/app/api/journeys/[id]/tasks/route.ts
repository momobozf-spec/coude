import { NextResponse } from 'next/server'
import { JourneyStage, TaskStatus } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { getJourneyTasks } from '@/modules/journey/views'
import { setTaskStatus } from '@/modules/journey/service'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

/** De taken van een traject, met blokkering en de reden daarvan. */
export const GET = withErrorHandling(async (request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  const stage = new URL(request.url).searchParams.get('stage')
  const tasks = await getJourneyTasks(userId, id)

  const filtered =
    stage && (Object.values(JourneyStage) as string[]).includes(stage)
      ? tasks.filter((t) => t.stage === stage)
      : tasks

  return NextResponse.json({ tasks: filtered })
})

const patchSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TaskStatus),
})

/**
 * Wijzigt de status van een taak.
 *
 * De service verwerkt de hele keten: afhankelijkheden, voortgang, fase-overgang
 * en analytics. Het antwoord bevat wat er door deze wijziging is vrijgekomen,
 * zodat een client zijn scherm kan bijwerken zonder alles opnieuw op te halen.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const userId = await requireUserId()
  // Het journeyId in het pad is context; de eigendomscheck loopt via de taak
  // zelf, die aan een userId hangt.
  await context.params

  const { taskId, status } = patchSchema.parse(await request.json())
  const result = await setTaskStatus(userId, taskId, status)

  return NextResponse.json({
    task: { id: result.taskId, status: result.status },
    progress: result.progress,
    unlockedTaskIds: result.unlockedTaskIds,
    stage: {
      current: result.stage.currentStage,
      advanced: result.stage.advanced,
      reason: result.stage.reason,
    },
  })
})
