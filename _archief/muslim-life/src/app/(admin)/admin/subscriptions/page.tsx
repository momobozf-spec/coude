import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'Subscriptions',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  await requireAdmin()

  const subscriptions = await prisma.subscription.findMany({
    where: { plan: 'PREMIUM' },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      interval: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      user: { select: { email: true, name: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Premium members. Stripe synchronisation arrives in phase five."
      />

      <Card className="overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Member', 'Status', 'Interval', 'Renews', 'Cancelling'].map((h) => (
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
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  No premium subscriptions yet.
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => (
                <tr key={subscription.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{subscription.user.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{subscription.user.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {subscription.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {subscription.interval ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {subscription.currentPeriodEnd
                      ? formatDate(utcDateToIsoDate(subscription.currentPeriodEnd), 'en', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {subscription.cancelAtPeriodEnd ? (
                      <Badge variant="warning" size="sm">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
