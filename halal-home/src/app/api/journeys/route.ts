/**
 * /api/journeys — de trajecten van de ingelogde gebruiker.
 *
 * Let op wat hier NIET staat: nergens wordt een `userId` uit de request gelezen.
 * Hij komt altijd uit `requireUserId()`, dus uit de sessie.
 */
import { NextResponse } from 'next/server'
import { JourneyStage, PurchaseTimeline, PurchaseType } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { createJourneyWithBlueprint } from '@/modules/journey/service'
import { listJourneys } from '@/modules/journey/repository'
import { withErrorHandling } from '@/server/api/handler'
import { MAX_AMOUNT_CENTS } from '@/lib/money'

export const GET = withErrorHandling(async () => {
  const userId = await requireUserId()
  return NextResponse.json({ journeys: await listJourneys(userId) })
})

const amountCents = z.number().int().min(0).max(MAX_AMOUNT_CENTS)

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  country: z.string().length(2).default('BE'),
  region: z.string().max(50).nullish(),
  // Bedragen in eurocent. Zie src/lib/money.ts.
  targetBudgetCents: amountCents.nullish(),
  ownContributionCents: amountCents.nullish(),
  needsFinancing: z.boolean().nullish(),
  targetLocation: z.string().max(120).nullish(),
  targetPostalCode: z.string().regex(/^\d{4}$/).nullish(),
  searchRadiusKm: z.number().int().min(1).max(100).nullish(),
  purchaseType: z.enum(PurchaseType).optional(),
  timeline: z.enum(PurchaseTimeline).optional(),
  targetDate: z.coerce.date().nullish(),
  firstHome: z.boolean().default(true),
  startStage: z.enum(JourneyStage).optional(),
})

export const POST = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = createSchema.parse(await request.json())

  // Idempotent: een tweede POST met dezelfde naam geeft het bestaande traject
  // terug in plaats van een duplicaat te maken.
  const journey = await createJourneyWithBlueprint(userId, input)
  return NextResponse.json({ journey }, { status: 201 })
})
