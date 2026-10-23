import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Package, Heart, MapPin, Settings, ArrowRight } from "lucide-react";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/nl/login");
  const t = await getTranslations("account");
  const user = session.user as { id: string; name?: string; email?: string; role?: string };

  const [orderCount, recentOrders, vendor] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    prisma.vendor.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);
  const totalSpent = recentOrders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {vendor && (
            <Link href="/account/dashboard" className="text-sm font-medium px-4 py-2 rounded-full bg-secondary text-white hover:opacity-90 transition-opacity">{t("sellerDashboard")}</Link>
          )}
          {user.role === "ADMIN" && (
            <a href="/admin" className="text-sm font-medium px-4 py-2 rounded-full bg-emerald text-white hover:opacity-90 transition-opacity">Admin</a>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          { icon: Package, label: t("orders"), href: "/account/orders", count: orderCount.toString() },
          { icon: Heart, label: t("wishlist"), href: "/account/wishlist", count: "" },
          { icon: MapPin, label: t("addresses"), href: "/account/addresses", count: "" },
          { icon: Settings, label: t("settings"), href: "/account/settings", count: "" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-border p-6 hover:border-emerald/50 transition-colors group">
            <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-emerald mb-3" />
            <p className="font-semibold text-sm">{item.label}</p>
            {item.count && <p className="text-xs text-muted-foreground">{item.count}</p>}
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold text-lg font-[family-name:var(--font-heading)]">{t("orders")}</h2>
          <Link href="/account/orders" className="text-sm font-medium flex items-center gap-1 hover:text-emerald transition-colors">
            {t("orders")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{t("noOrders")}</div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.createdAt).toLocaleDateString("nl-BE")}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatPrice(order.total)}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.status === "DELIVERED" ? "bg-emerald-100 text-emerald-800" : order.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
