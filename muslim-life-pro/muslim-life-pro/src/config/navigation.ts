import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Repeat,
  Settings,
  LineChart,
  Sparkles,
  Tag,
  Users,
  Compass,
  Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  /** i18n key under `nav.` */
  key: string
  href: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar (max 5 — anything else lives under "More"). */
  primary?: boolean
  premium?: boolean
}

export const APP_NAV: NavItem[] = [
  { key: 'today', href: '/app', icon: LayoutDashboard, primary: true },
  { key: 'planner', href: '/app/planner', icon: CalendarDays, primary: true },
  { key: 'habits', href: '/app/habits', icon: Repeat, primary: true },
  { key: 'explore', href: '/app/explore', icon: Compass, primary: true },
  { key: 'assistant', href: '/app/assistant', icon: Sparkles, primary: true },
]

export const APP_SECONDARY_NAV: NavItem[] = [
  { key: 'review', href: '/app/review', icon: LineChart },
  { key: 'settings', href: '/app/settings', icon: Settings },
]

export const ADMIN_NAV: NavItem[] = [
  { key: 'overview', href: '/admin', icon: BarChart3 },
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'businesses', href: '/admin/businesses', icon: Building2 },
  { key: 'deals', href: '/admin/deals', icon: Tag },
  { key: 'subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { key: 'aiUsage', href: '/admin/ai-usage', icon: MessageSquareText },
  { key: 'categories', href: '/admin/categories', icon: ListChecks },
  { key: 'operations', href: '/admin/operations', icon: Activity },
]

/**
 * Active-state matching. `/app` must not light up for `/app/planner`, so the
 * dashboard root is matched exactly while every other item matches by prefix.
 */
export function isNavItemActive(pathname: string, href: string, exactRoots = ['/app', '/admin']) {
  if (exactRoots.includes(href)) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
