import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'

export const metadata: Metadata = { title: 'AI usage', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const COLUMNS = ['Member', 'Period', 'Messages', 'Generators', 'Tokens in', 'Tokens out']

export default async function AdminAiUsagePage() {
  await requireAdmin()

  const usage = await prisma.aIUsage.findMany({
    orderBy: [{ period: 'desc' }, { messageCount: 'desc' }],
    take: 100,
    select: {
      id: true,
      period: true,
      messageCount: true,
      generatorCount: true,
      tokensIn: true,
      tokensOut: true,
      user: { select: { email: true, name: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI usage"
        description="Per-member consumption, used to enforce quotas and watch cost per free member."
      />

      <Card className="overflow-x-auto scrollbar-subtle">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((heading) => (
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
            {usage.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-5 py-8 text-center text-muted-foreground">
                  No AI usage recorded yet. The assistant ships in phase four.
                </td>
              </tr>
            ) : (
              usage.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{row.user.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{row.user.email}</p>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">{row.period}</td>
                  <td className="px-5 py-3.5 tabular-nums">{row.messageCount}</td>
                  <td className="px-5 py-3.5 tabular-nums">{row.generatorCount}</td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">{row.tokensIn}</td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">{row.tokensOut}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
