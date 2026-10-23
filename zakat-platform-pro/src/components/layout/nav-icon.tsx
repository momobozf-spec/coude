import {
  Bell,
  CalendarDays,
  Calculator,
  Circle,
  FileBarChart,
  HandCoins,
  Heart,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * Navigation is defined as data in `src/config/navigation.ts`, which cannot hold
 * a component reference. This maps the icon name back to a component, with an
 * explicit registry rather than a dynamic import so tree-shaking still works.
 */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Bell,
  Calculator,
  Wallet,
  HandCoins,
  Heart,
  Sparkles,
  CalendarDays,
  FileBarChart,
  Users,
  User,
  ShieldCheck,
}

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} aria-hidden />
}
