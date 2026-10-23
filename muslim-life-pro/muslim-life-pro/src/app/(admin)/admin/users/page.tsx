import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { listRecentUsers } from '@/server/modules/admin/admin.service'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Users', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const users = await listRecentUsers(100)

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={`${users.length} most recent members.`} />

      <Card className="overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Member', 'City', 'Plan', 'Status', 'Role', 'Onboarded', 'Joined'].map((h) => (
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
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
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
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {user.subscription?.status ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={user.role === 'ADMIN' ? 'primary' : 'outline'} size="sm">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={user.onboardedAt ? 'success' : 'default'} size="sm">
                      {user.onboardedAt ? 'Yes' : 'No'}
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
    </div>
  )
}
