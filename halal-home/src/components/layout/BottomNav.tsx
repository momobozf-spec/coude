'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Home, Landmark, Route, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bottom navigation.
 *
 * VIJF ITEMS, NIET NEGEN. Het platform heeft tien modules, maar een balk met
 * tien iconen op een telefoon van 375 px geeft raakvlakken van 37 px — te klein
 * om betrouwbaar te treffen, en te druk om te scannen.
 *
 * De vijf hier zijn de plekken waar iemand tijdens een aankooptraject dagelijks
 * heen gaat. De rest (buurt, checklist, AI, profiel) hangt onder de schermen
 * waar ze bij horen: buurt onder een woning, checklist onder het traject.
 */
const ITEMS = [
  { href: '/dashboard', label: 'Start', icon: Home },
  { href: '/journey', label: 'Traject', icon: Route },
  { href: '/documents', label: 'Documenten', icon: FileText },
  { href: '/search', label: 'Zoeken', icon: Search },
  { href: '/financing', label: 'Financiering', icon: Landmark },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          // startsWith, zodat /documents/123 het tabblad Documenten actief houdt.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px]',
                  active ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]',
                )}
              >
                <Icon size={20} aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Dezelfde bestemmingen, als zijbalk vanaf tablet. */
export function SideNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Hoofdnavigatie" className="hidden md:block">
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-[var(--color-olive-100)] font-semibold text-[var(--color-olive-700)]'
                    : 'text-[var(--muted)] hover:bg-[var(--color-sand-100)]',
                )}
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
