import Link from "next/link";
import { Activity, BarChart3, Bell, Building2, Database, FileUp, KanbanSquare, Map, Radar, Settings, ShieldCheck, Sparkles, Sunrise, Users } from "lucide-react";
import type { AuthUser } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth";
import { AgencySwitcher } from "./agency-switcher";

const NAV = [
  { href: "/", label: "Today's Opportunities", icon: Sunrise },
  { href: "/market", label: "Market Radar", icon: Radar },
  { href: "/leadrevive", label: "LeadRevive", icon: Sparkles },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/territories", label: "Territories", icon: Map },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [
  { href: "/admin/sources", label: "Sources", icon: Database },
  { href: "/admin/collectors", label: "Collector Health", icon: Activity },
  { href: "/admin/agencies", label: "Agencies", icon: Users },
  { href: "/admin/system", label: "System Health", icon: ShieldCheck },
];

export function Sidebar({ user, agencyName, agencies }: { user: AuthUser; agencyName: string; agencies: Array<{ id: string; name: string }> }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-200 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">IR</div>
        <div>
          <p className="text-sm font-semibold leading-tight">ImmoRadar</p>
          <p className="text-xs text-ink-500">{agencyName}</p>
        </div>
      </div>
      {user.role === "PLATFORM_ADMIN" ? <AgencySwitcher agencies={agencies} /> : null}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100 hover:text-ink-900">
                <item.icon className="h-4 w-4 text-ink-400" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {user.role === "PLATFORM_ADMIN" ? (
          <>
            <p className="mt-5 mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Platform</p>
            <ul className="space-y-0.5">
              {ADMIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100 hover:text-ink-900">
                    <item.icon className="h-4 w-4 text-ink-400" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
      <div className="border-t border-ink-200 px-4 py-3">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-ink-500">{user.role.replace("_", " ").toLowerCase()}</p>
        <form action={logoutAction} className="mt-2">
          <button className="btn btn-sm w-full justify-center" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
