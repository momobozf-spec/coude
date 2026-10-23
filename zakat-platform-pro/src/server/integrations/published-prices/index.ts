import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { PublishedPriceSource } from '@/server/integrations/published-prices/core'

export * from '@/server/integrations/published-prices/core'

/** De gepubliceerde prijzen uit de database. */
export const databasePublishedPriceSource: PublishedPriceSource = {
  async latest(kind, currency, onOrBefore) {
    const row = await prisma.publishedPrice.findFirst({
      where: { kind, currency: currency.toUpperCase(), effectiveDate: { lte: onOrBefore } },
      orderBy: { effectiveDate: 'desc' },
      select: { value: true, effectiveDate: true, source: true },
    })

    return row
      ? { value: row.value.toString(), effectiveDate: row.effectiveDate, source: row.source }
      : null
  },
}
