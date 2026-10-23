import type { Feature } from '@/config/plans'

/**
 * Navigation is data, so the sidebar, the mobile bottom bar and the command
 * palette (later) all read the same list.
 */

export interface NavItem {
  href: string
  label: string
  /** Lucide icon name, resolved in the layout component. */
  icon: string
  /** Hidden when the plan lacks this feature. Undefined = always visible. */
  feature?: Feature
  /** Shown in the mobile bottom bar (§3 — max five). */
  mobile?: boolean
}

export const DASHBOARD_NAV: readonly NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'LayoutDashboard', mobile: true },
  { href: '/zakat', label: 'Zakat', icon: 'Calculator', mobile: true },
  { href: '/assets', label: 'Vermogen', icon: 'Wallet' },
  { href: '/donations', label: 'Donaties', icon: 'HandCoins', mobile: true },
  { href: '/charities', label: 'Goede doelen', icon: 'Heart' },
  { href: '/sadaqah', label: 'Sadaqah', icon: 'Sparkles' },
  { href: '/calendar', label: 'Kalender', icon: 'CalendarDays' },
  { href: '/notifications', label: 'Meldingen', icon: 'Bell' },
  { href: '/reports', label: 'Rapporten', icon: 'FileBarChart', feature: 'YEARLY_REPORTS' },
  { href: '/family', label: 'Gezin', icon: 'Users', feature: 'HOUSEHOLD' },
  { href: '/profile', label: 'Profiel', icon: 'User', mobile: true },
] as const

/** Alleen zichtbaar voor beheerders (rol ADMIN). */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: '/admin/prijzen', label: 'Beheer: prijzen', icon: 'ShieldCheck' },
] as const

export const MOBILE_NAV = DASHBOARD_NAV.filter((item) => item.mobile)
