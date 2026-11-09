import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { compareProducts } from '@/modules/financing/service'
import { MAX_FINANCING_COMPARE } from '@/modules/financing/domain/comparison'
import { withErrorHandling } from '@/server/api/handler'
import { MAX_AMOUNT_CENTS } from '@/lib/money'

const bodySchema = z
  .object({
    productIds: z.array(z.string().min(1)).min(2).max(MAX_FINANCING_COMPARE),
    purchasePriceCents: z.number().int().positive().max(MAX_AMOUNT_CENTS),
    ownContributionCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS),
    termMonths: z.number().int().min(1).max(480),
    sort: z.enum(['provider', 'payment', 'ownContribution']).optional(),
  })
  .refine((input) => input.ownContributionCents < input.purchasePriceCents, {
    path: ['ownContributionCents'],
    message: 'Je eigen middelen dekken de volledige aankoopprijs',
  })

/**
 * POST omdat er een berekening plaatsvindt en de invoer een body verdient —
 * niet omdat er iets gewijzigd wordt. Er wordt niets opgeslagen.
 */
export const POST = withErrorHandling(async (request: Request) => {
  await requireUserId()
  const input = bodySchema.parse(await request.json())

  return NextResponse.json({ comparison: await compareProducts(input) })
})
