import type { Metadata } from 'next'
import { Lock } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { listDealsForAdmin } from '@/server/modules/admin/admin.service'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { t } from '@/i18n'

export const metadata: Metadata = { title: 'Deals', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function formatDiscount(type: string, value: number) {
  switch (type) {
    case 'PERCENTAGE':
      return `${value}%`
    case 'FIXED':
      return `€${(value / 100).toFixed(2)}`
    case 'BOGO':
      return 'BOGO'
    default:
      return 'Freebie'
  }
}

export default async function AdminDealsPage() {
  const deals = await listDealsForAdmin(100)

  return (
    <div className="space-y-6">
      <PageHeader title="Deals" description="Offers across all partner listings." />

      <Card className="overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Deal', 'Business', 'Discount', 'Access', 'Status', 'Ends', 'Redeemed'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-5 py-3 text-start text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                  No deals yet. Run <code className="text-xs">npm run db:seed</code>.
                </td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr key={deal.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{deal.title}</span>
                      {deal.isDemo ? (
                        <Badge variant="default" size="sm">
                          {t('common.demo')}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {deal.business.name}
                    <span className="ms-1 text-xs">· {deal.business.city.name}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium tabular-nums">
                    {formatDiscount(deal.discountType, deal.discountValue)}
                  </td>
                  <td className="px-5 py-3.5">
                    {deal.isPremiumOnly ? (
                      <Badge variant="accent" size="sm">
                        <Lock className="size-2.5" />
                        {t('common.premium')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" size="sm">
                        All
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={deal.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                      {deal.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {formatDate(utcDateToIsoDate(deal.endsAt), 'en', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                    {deal.redemptionCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
