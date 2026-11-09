import { NextResponse } from 'next/server'
import { JourneyStage } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { findJourneyWithTasks } from '@/modules/journey/repository'
import { changeStage } from '@/modules/journey/service'
import { withErrorHandling } from '@/server/api/handler'
import { NotFoundError } from '@/lib/errors'

type Context = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  const journey = await findJourneyWithTasks(userId, id)
  if (!journey) throw new NotFoundError('Traject niet gevonden')

  return NextResponse.json({ journey })
})

const patchSchema = z.object({
  currentStage: z.enum(JourneyStage),
})

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params
  const { currentStage } = patchSchema.parse(await request.json())

  return NextResponse.json(await changeStage(userId, id, currentStage))
})
