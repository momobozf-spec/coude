import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Package, Wrench, ShoppingCart, Store, Plus, ArrowRight, BadgeCheck } from "lucide-react";

export default async function SellerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/nl/login");
  const t = await getTranslations("dashboard");
  const user = session.user as { id: string; email?: string; role?: string };

  const vendor = await prisma.vendor.findFirst({
    where: { userId: user.id },
    include: {
      products: { orderBy: { createdAt: "desc" } },
      services: { include: { category: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  // No linked vendor → invite to apply.
  if (!vendor) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sage/30">
          <Store className="h-7 w-7 text-emerald" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("noVendorTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t("noVendorBody")}</p>
        <Link href="/sell" className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-dark">
          {t("becomeSeller")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // Orders containing this vendor's products.
  const orderItems = await prisma.orderItem.findMany({
    where: { product: { vendorId: vendor.id } },
    include: { order: { select: { orderNumber: true, status: true, createdAt: true } }, product: { select: { name: true } } },
    orderBy: { id: "desc" },
    take: 10,
  });

  const revenue = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const isAdmin = user.role === "ADMIN";

  const stats = [
    { icon: Package, label: t("statProducts"), value: vendor.products.length },
    { icon: Wrench, label: t("statServices"), value: vendor.services.length },
    { icon: ShoppingCart, label: t("statOrders"), value: orderItems.length },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel">{t("eyebrow")}</span>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
            {vendor.name}
            {vendor.verified && <BadgeCheck className="h-6 w-6 text-emerald" />}
          </h1>
          <p className="mt-1 text-muted-foreground">{vendor.tagline}</p>
        </div>
        <Link href={`/vendors/${vendor.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
          {t("viewPublic")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white p-5">
            <s.icon className="h-5 w-5 text-emerald" />
            <p className="mt-3 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-border bg-white p-5">
          <span className="text-sm font-semibold text-emerald">€</span>
          <p className="mt-3 text-2xl font-bold">{formatPrice(revenue)}</p>
          <p className="text-xs text-muted-foreground">{t("statRevenue")}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Products */}
        <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-semibold">{t("myProducts")}</h2>
            {isAdmin && (
              <a href="/admin/products/new" className="inline-flex items-center gap-1 text-sm font-medium text-emerald hover:underline">
                <Plus className="h-4 w-4" />{t("addProduct")}
              </a>
            )}
          </div>
          {vendor.products.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {vendor.products.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between p-4 text-sm">
                  <span className="line-clamp-1">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatPrice(p.price)} · {t("stock")}: {p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Services */}
        <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-semibold">{t("myServices")}</h2>
            <Link href="/sell" className="inline-flex items-center gap-1 text-sm font-medium text-emerald hover:underline">
              <Plus className="h-4 w-4" />{t("addService")}
            </Link>
          </div>
          {vendor.services.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("noServices")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {vendor.services.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between p-4 text-sm">
                  <span className="line-clamp-1">{s.title}</span>
                  <span className="shrink-0 text-muted-foreground">{s.category.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Orders */}
      <section className="mt-8 rounded-2xl border border-border bg-white">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">{t("recentOrders")}</h2>
        </div>
        {orderItems.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {orderItems.map((i) => (
              <li key={i.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{i.product.name}</p>
                  <p className="text-xs text-muted-foreground">{i.order.orderNumber} · {new Date(i.order.createdAt).toLocaleDateString("nl-BE")}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(i.price * i.quantity)}</p>
                  <p className="text-xs text-muted-foreground">{i.quantity}× · {i.order.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
