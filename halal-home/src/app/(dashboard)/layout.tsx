import { redirect } from 'next/navigation'
import Link from 'next/link'

import { BottomNav, SideNav } from '@/components/layout/BottomNav'
import { getCurrentUser } from '@/modules/auth/session'
import { APP_NAME } from '@/config/public'

/**
 * De schil rond alles wat achter een login zit.
 *
 * De authenticatiecheck staat hier en niet per pagina. Een nieuwe pagina onder
 * `(dashboard)/` is daarmee automatisch beschermd — je kan niet vergeten hem toe
 * te voegen, wat de meest voorkomende manier is waarop dit soort gaten ontstaat.
 * De middleware doet hetzelfde nog eens op edge-niveau.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 md:px-6">
        {/* Zijbalk vanaf tablet; op de telefoon staat dezelfde navigatie onderaan. */}
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 py-6 md:block">
          <Link href="/dashboard" className="mb-8 block px-3 text-lg font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <SideNav />
          <div className="mt-8 border-t px-3 pt-4">
            <Link
              href="/profile"
              className="block text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {user.name ?? 'Profiel'}
            </Link>
          </div>
        </aside>

        {/* pb-24 op mobiel: ruimte voor de bottom navigation. */}
        <main id="main" className="min-w-0 flex-1 pb-24 pt-6 md:pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
