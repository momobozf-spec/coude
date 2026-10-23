import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AdminNav } from '@/components/layout/admin-nav'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { getActor } from '@/server/auth/actor'
import { t } from '@/i18n'

/**
 * Admin is gated twice: middleware rejects non-admins before this renders, and
 * this layout rejects them again. Defence in depth — a middleware matcher change
 * must never silently expose the admin area.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor) redirect('/session-ended')
  if (actor.role !== 'ADMIN') redirect('/app')

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Logo href="/admin" showWordmark={false} />
          <Badge variant="outline" size="sm">
            {t('nav.admin')}
          </Badge>

          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" />
              {t('errors.backToApp')}
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-5">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}
