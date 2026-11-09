import { NextResponse } from 'next/server'
import { FinancingQuoteStatus } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { deleteQuote, requireQuote, updateQuoteMeta } from '@/modules/financing/repository'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  // `requireQuote` filtert op userId: de quote van iemand anders geeft 404,
  // niet 403 — wie geen toegang heeft, hoort niet te kunnen afleiden dát hij
  // bestaat.
  return NextResponse.json({ quote: await requireQuote(userId, id) })
})

/**
 * Alleen status en notitie zijn wijzigbaar.
 *
 * De snapshotvelden staan bewust niet in dit schema. Een bewaarde berekening
 * hoort niet te veranderen; wie een andere berekening wil, maakt een nieuwe.
 */
const patchSchema = z.object({
  status: z.enum(FinancingQuoteStatus).optional(),
  notes: z.string().max(2000).nullish(),
})

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  await updateQuoteMeta(userId, id, patchSchema.parse(await request.json()))
  return NextResponse.json({ quote: await requireQuote(userId, id) })
})

export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  await deleteQuote(userId, id)
  return new NextResponse(null, { status: 204 })
})
