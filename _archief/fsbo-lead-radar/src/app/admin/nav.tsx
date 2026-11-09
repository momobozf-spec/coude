'use client'

import { usePathname } from 'next/navigation'

import { NavLink } from '@/components/ui'

const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/listings', label: 'Advertenties', exact: false },
  { href: '/admin/agencies', label: 'Makelaars', exact: false },
  { href: '/admin/sources', label: 'Bronnen', exact: false },
] as const

/**
 * De navigatie is de enige clientcomponent in het dashboard. Reden: alleen zij
 * heeft het huidige pad nodig om te weten welk item actief is. Al het andere
 * rendert op de server, zodat er geen data naar de browser gaat die daar niet
 * getoond wordt.
 */
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          active={link.exact ? pathname === link.href : pathname.startsWith(link.href)}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
