import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { listBusinessesForAdmin } from '@/server/modules/admin/admin.service'
import { t } from '@/i18n'

export const metadata: Metadata = { title: 'Businesses', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminBusinessesPage() {
  const businesses = await listBusinessesForAdmin(100)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="Listings across all cities. Demo listings are labelled everywhere they appear in the product."
      />

      <Card className="overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Business', 'Category', 'City', 'Tier', 'Status', 'Deals'].map((h) => (
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
            {businesses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                  No businesses yet. Run <code className="text-xs">npm run db:seed</code>.
                </td>
              </tr>
            ) : (
              businesses.map((business) => (
                <tr key={business.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{business.name}</span>
                      {business.isDemo ? (
                        <Badge variant="default" size="sm">
                          {t('common.demo')}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{business.category.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{business.city.name}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={business.tier === 'FEATURED' ? 'accent' : 'outline'} size="sm">
                      {business.tier}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={business.status === 'PUBLISHED' ? 'success' : 'default'}
                      size="sm"
                    >
                      {business.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                    {business._count.deals}
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
