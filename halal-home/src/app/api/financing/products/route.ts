import { NextResponse } from 'next/server'
import { FinancingType, ShariahAssessmentStatus } from '@prisma/client'

import { requireUserId } from '@/modules/auth/session'
import { listProductViews } from '@/modules/financing/service'
import { withErrorHandling } from '@/server/api/handler'

/**
 * /api/financing/products
 *
 * Filters: country, type (meerdere), shariah (meerdere), verified, excludeDemo,
 * amount, term, ownContributionPercentage.
 *
 * Onbekende filterwaarden worden genegeerd in plaats van te falen: een client
 * die een enum-waarde meestuurt die wij niet kennen, hoort een lijst te krijgen,
 * geen 400.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireUserId()
  const params = new URL(request.url).searchParams

  const enumValues = <T extends Record<string, string>>(
    values: string[],
    enumObject: T,
  ): T[keyof T][] =>
    values.filter((v): v is T[keyof T] => Object.values(enumObject).includes(v))

  const products = await listProductViews({
    country: params.get('country') ?? 'BE',
    financingTypes: enumValues(params.getAll('type'), FinancingType),
    shariahStatuses: enumValues(params.getAll('shariah'), ShariahAssessmentStatus),
    onlyVerified: params.get('verified') === 'true',
    excludeDemo: params.get('excludeDemo') === 'true',
    amount: numeric(params.get('amount')),
    termMonths: numeric(params.get('term')),
    maxOwnContributionPercentage: numeric(params.get('ownContributionPercentage')),
  })

  return NextResponse.json({ products })
})

function numeric(raw: string | null): number | undefined {
  if (raw === null) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : undefined
}
