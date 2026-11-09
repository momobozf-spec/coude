/**
 * /api/financing/calculate — deterministische berekening.
 *
 * Geen AI in deze route. Zie de kop van
 * src/modules/financing/domain/calculators/types.ts: dit is het getal waarop
 * iemand een aankoop van honderdduizenden euro's baseert.
 *
 * Er wordt niets opgeslagen. Bewaren gaat via POST /api/financing/quotes.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { calculateForProduct } from '@/modules/financing/service'
import { withErrorHandling } from '@/server/api/handler'
import { MAX_AMOUNT_CENTS } from '@/lib/money'

const bodySchema = z
  .object({
    productId: z.string().min(1),
    // Bedragen in eurocent; zie src/lib/money.ts.
    purchasePriceCents: z.number().int().positive().max(MAX_AMOUNT_CENTS),
    ownContributionCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS),
    termMonths: z.number().int().min(1).max(480),
  })
  .refine((input) => input.ownContributionCents < input.purchasePriceCents, {
    path: ['ownContributionCents'],
    message: 'Je eigen middelen dekken de volledige aankoopprijs — er valt niets te financieren',
  })

export const POST = withErrorHandling(async (request: Request) => {
  await requireUserId()
  const input = bodySchema.parse(await request.json())

  const { product, result } = await calculateForProduct(input)

  // Een `unavailable`-resultaat is geen fout maar een uitkomst: het product
  // publiceert de gegevens niet die de berekening nodig heeft. De reden hoort
  // de gebruiker te lezen, dus die gaat gewoon mee in het antwoord.
  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      providerName: product.provider.name,
      financingType: product.financingType,
      currency: product.currency,
      isDemo: product.isDemo,
    },
    result,
  })
})
