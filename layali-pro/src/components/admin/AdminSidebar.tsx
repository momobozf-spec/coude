"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Producten", href: "/admin/products", icon: Package },
  { label: "Bestellingen", href: "/admin/orders", icon: ShoppingCart },
  { label: "Importeren", href: "/admin/import", icon: Upload },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-white min-h-screen">
      <div className="p-6">
        <Link
          href="/nl"
          className="text-xl font-bold tracking-tight font-[family-name:var(--font-heading)] text-emerald"
        >
          Layali
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Beheerpaneel</p>
      </div>

      <nav className="px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald/10 text-emerald"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-8">
        <Link
          href="/nl"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar winkel
        </Link>
      </div>
    </aside>
  );
}
