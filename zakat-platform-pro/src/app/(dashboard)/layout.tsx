import Link from 'next/link'

import { BottomNav, SidebarNav } from '@/components/layout/dashboard-nav'
import { Badge } from '@/components/ui'
import { ADMIN_NAV, DASHBOARD_NAV } from '@/config/navigation'
import { siteConfig } from '@/config/site'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { canUseFeature, planOf } from '@/server/services/entitlements'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActorOrRedirect()

  // The client receives only the items it is entitled to — never the plan table.
  const items = [
    ...DASHBOARD_NAV.filter((item) => !item.feature || canUseFeature(actor, item.feature)),
    ...(actor.role === 'ADMIN' ? ADMIN_NAV : []),
  ]
  const mobileItems = items.filter((item) => item.mobile)

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </Link>
        </div>

        <div className="flex-1 px-3 pb-4">
          <SidebarNav items={items} />
        </div>

        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{actor.name ?? 'Mijn account'}</p>
          <Badge tone={actor.plan === 'FREE' ? 'neutral' : 'success'} className="mt-2">
            {planOf(actor).name}
          </Badge>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {siteConfig.name}
          </Link>
          <Badge tone={actor.plan === 'FREE' ? 'neutral' : 'success'}>{planOf(actor).name}</Badge>
        </header>

        {/* Bottom padding keeps the last row clear of the mobile nav bar. */}
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav items={mobileItems} />
    </div>
  )
}

export const dynamic = 'force-dynamic'
