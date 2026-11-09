import { NextResponse } from 'next/server'
import { FinancingQuoteStatus } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { listQuotes } from '@/modules/financing/repository'
import { saveQuote } from '@/modules/financing/service'
import { syncFinancingTasks } from '@/modules/financing/journeyBridge'
import { findActiveJourney } from '@/modules/journey/repository'
import { withErrorHandling } from '@/server/api/handler'
import { MAX_AMOUNT_CENTS } from '@/lib/money'
import { logger } from '@/lib/logger'

export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const status = params.get('status')

  return NextResponse.json({
    quotes: await listQuotes(userId, {
      propertyId: params.get('propertyId') ?? undefined,
      status:
        status && (Object.values(FinancingQuoteStatus) as string[]).includes(status)
          ? (status as FinancingQuoteStatus)
          : undefined,
    }),
  })
})

const amountCents = z.number().int().min(0).max(MAX_AMOUNT_CENTS)

const createSchema = z
  .object({
    productId: z.string().min(1),
    purchasePriceCents: amountCents.refine((v) => v > 0, 'Vul een aankoopprijs in'),
    ownContributionCents: amountCents,
    termMonths: z.number().int().min(1).max(480),
    propertyId: z.string().nullish(),
    status: z.enum(FinancingQuoteStatus).optional(),
    notes: z.string().max(2000).nullish(),
  })
  .refine((input) => input.ownContributionCents < input.purchasePriceCents, {
    path: ['ownContributionCents'],
    message: 'Je eigen middelen dekken de volledige aankoopprijs',
  })

export const POST = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = createSchema.parse(await request.json())

  const journey = await findActiveJourney(userId)
  const quote = await saveQuote(userId, { ...input, journeyId: journey?.id ?? null })

  // De taaksynchronisatie mag het bewaren nooit terugdraaien.
  let completedTaskKeys: string[] = []
  if (journey) {
    try {
      completedTaskKeys = (await syncFinancingTasks(userId, journey.id)).completedTaskKeys
    } catch (error) {
      logger.warn('Taaksynchronisatie na quote mislukt', {
        error: error instanceof Error ? error.message : 'onbekend',
      })
    }
  }

  return NextResponse.json({ quote, completedTaskKeys }, { status: 201 })
})
