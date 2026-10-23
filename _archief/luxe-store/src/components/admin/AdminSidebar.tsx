"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-muted/30 p-6 shrink-0 hidden lg:block">
      <div className="flex items-center justify-between mb-8">
        <Link href="/admin" className="text-xl font-bold tracking-tight">
          LUXE
        </Link>
        <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
          Admin
        </span>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 pt-8 border-t border-border">
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      <div className="absolute bottom-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>
      </div>
    </aside>
  );
}
