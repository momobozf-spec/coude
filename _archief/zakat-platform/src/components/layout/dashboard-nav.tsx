'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavIcon } from '@/components/layout/nav-icon'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'

/**
 * Both navigations are driven by the same filtered item list, which the server
 * layout computes from the actor's entitlements — the client never receives the
 * plan table, only the items it is allowed to see.
 */

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Hoofdnavigatie" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-subtle text-primary'
                : 'text-muted hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <NavIcon name={item.icon} className="size-4.5 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function BottomNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden',
        // Keep the bar clear of the iOS home indicator.
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted',
                )}
              >
                <NavIcon name={item.icon} className="size-5" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
