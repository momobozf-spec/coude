import { redirect } from 'next/navigation'

import { AdminNav } from './nav'

import { Button } from '@/components/ui'
import { clearSessionCookie, isAuthenticated, isOpenAccessMode } from '@/lib/auth'
import { writeAudit } from '@/services/auditService'

export const dynamic = 'force-dynamic'

async function logout(): Promise<void> {
  'use server'
  await clearSessionCookie()
  await writeAudit({ actor: 'admin', action: 'ADMIN_LOGOUT' })
  redirect('/login')
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // De middleware stuurt bezoekers zonder cookie al weg; deze controle kijkt of
  // het cookie ook echt geldig is. Dat is de controle die telt.
  if (!(await isAuthenticated())) redirect('/login')

  const openAccess = isOpenAccessMode()

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-panel)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="text-sm font-semibold">FSBO Lead Radar</span>
          <span className="rounded bg-[var(--color-panel-soft)] px-1.5 py-0.5 text-[11px] text-[var(--color-ink-soft)]">
            België
          </span>

          <AdminNav />

          {!openAccess && (
            <form action={logout} className="ml-auto">
              <Button variant="ghost" type="submit">
                Afmelden
              </Button>
            </form>
          )}
        </div>
      </header>

      {openAccess && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Onbeveiligde modus: er is geen <code>ADMIN_PASSWORD</code> ingesteld. Dit kan alleen
          buiten productie — in productie weigert de app zo te starten.
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
