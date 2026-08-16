import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { logoutAction } from "../auth-actions";

export const dynamic = "force-dynamic";

const AGENCY_NAV = [
  { href: "/", label: "Today's Opportunities", icon: "🎯" },
  { href: "/market", label: "Market Radar", icon: "📡" },
  { href: "/leadrevive", label: "LeadRevive", icon: "💤" },
  { href: "/properties", label: "Properties", icon: "🏠" },
  { href: "/pipeline", label: "Pipeline", icon: "📊" },
  { href: "/territories", label: "Territories", icon: "🗺️" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/imports", label: "Imports", icon: "📥" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Sources", icon: "🔌" },
  { href: "/admin/health", label: "Collector Health", icon: "🩺" },
  { href: "/admin/agencies", label: "Agencies", icon: "🏢" },
  { href: "/admin/system", label: "System Health", icon: "🖥️" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const showAgencyNav = user.agencyId !== null;
  const showAdminNav = user.role === "PLATFORM_ADMIN";

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-slate-900 text-slate-300">
        <div className="px-5 py-5">
          <Link href={showAgencyNav ? "/" : "/admin"} className="text-xl font-bold tracking-tight text-white">
            Immo<span className="text-indigo-400">Radar</span>
          </Link>
          {user.agencyName ? (
            <div className="mt-1 truncate text-xs text-slate-500">{user.agencyName}</div>
          ) : null}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {showAgencyNav
            ? AGENCY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              ))
            : null}
          {showAdminNav ? (
            <>
              <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Platform
              </div>
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4">
          <div className="truncate text-sm font-medium text-white">
            {user.firstName} {user.lastName}
          </div>
          <div className="truncate text-xs text-slate-500">{user.role.replaceAll("_", " ").toLowerCase()}</div>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 min-h-screen flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
