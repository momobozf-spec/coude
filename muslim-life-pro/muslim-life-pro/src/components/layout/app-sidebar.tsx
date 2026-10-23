'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { APP_NAV, APP_SECONDARY_NAV, isNavItemActive } from '@/config/navigation'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function AppSidebar({ isPremium }: { isPremium: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-surface lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href="/app" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
        {APP_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isNavItemActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="space-y-0.5 px-3 py-2">
        {APP_SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isNavItemActive(pathname, item.href)} />
        ))}
      </div>

      {!isPremium ? (
        <div className="p-3">
          <div className="rounded-xl border border-border bg-primary-subtle p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary-subtle-foreground" />
              <p className="text-xs font-semibold text-primary-subtle-foreground">
                {t('common.premium')}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-primary-subtle-foreground/80">
              Unlimited habits, plan generators and more assistant messages.
            </p>
            <Button size="sm" className="mt-3 w-full" asChild>
              <Link href="/pricing">{t('common.upgrade')}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function NavLink({
  item,
  active,
}: {
  item: (typeof APP_NAV)[number]
  active: boolean
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-subtle text-primary-subtle-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <item.icon className="size-[1.125rem] shrink-0" />
      {t(`nav.${item.key}` as never)}
    </Link>
  )
}
