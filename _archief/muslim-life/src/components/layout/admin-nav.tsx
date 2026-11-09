'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ADMIN_NAV, isNavItemActive } from '@/config/navigation'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      className="scrollbar-subtle -mb-px flex gap-1 overflow-x-auto"
      aria-label="Admin sections"
    >
      {ADMIN_NAV.map((item) => {
        const active = isNavItemActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="size-4" />
            {t(`nav.${item.key}` as never)}
          </Link>
        )
      })}
    </nav>
  )
}
