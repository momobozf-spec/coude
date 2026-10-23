import type { Metadata } from 'next'
import { Building2, CreditCard, MessageSquareText, Tag, TrendingUp, Users } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getAdminMetrics, listRecentUsers } from '@/server/modules/admin/admin.service'
import { PRICING } from '@/config/plans'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { percentage } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const [metrics, users] = await Promise.all([getAdminMetrics(), listRecentUsers(10)])

  const conversion = percentage(metrics.premiumSubscribers, metrics.totalUsers)

  const stats = [
    {
      icon: Users,
      label: 'Members',
      value: metrics.totalUsers.toLocaleString(),
      hint: `${metrics.newUsersThisWeek} this week · ${percentage(metrics.onboardedUsers, metrics.totalUsers)}% onboarded`,
    },
    {
      icon: CreditCard,
      label: 'Premium',
      value: metrics.premiumSubscribers.toLocaleString(),
      hint: `${conversion}% conversion`,
    },
    {
      icon: TrendingUp,
      label: 'Estimated MRR',
      value: `${PRICING.symbol}${(metrics.estimatedMrrCents / 100).toFixed(2)}`,
      hint: 'Yearly plans normalised to monthly',
    },
    {
      icon: Building2,
      label: 'Businesses',
      value: metrics.totalBusinesses.toLocaleString(),
      hint: `${metrics.publishedBusinesses} published · ${metrics.demoBusinesses} demo`,
    },
    {
      icon: Tag,
      label: 'Active deals',
      value: metrics.activeDeals.toLocaleString(),
      hint: 'Currently redeemable',
    },
    {
      icon: MessageSquareText,
      label: 'AI messages',
      value: metrics.aiMessagesThisMonth.toLocaleString(),
      hint: 'This calendar month',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Live metrics across the platform." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center gap-2">
              <stat.icon className="size-3.5 text-muted-foreground" />
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">Recent members</h2>
        <Card className="overflow-x-auto scrollbar-subtle">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Member', 'City', 'Plan', 'Role', 'Joined'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-5 py-3 text-start text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No members yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{user.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {user.preference?.city?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={user.subscription?.plan === 'PREMIUM' ? 'accent' : 'default'}
                        size="sm"
                      >
                        {user.subscription?.plan ?? 'FREE'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.role === 'ADMIN' ? 'primary' : 'outline'} size="sm">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDate(utcDateToIsoDate(user.createdAt), 'en', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}
