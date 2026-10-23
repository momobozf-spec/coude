import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Package, ShoppingCart, Users, Euro } from "lucide-react";

async function getStats() {
  const [productCount, orderCount, customerCount, orders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.order.findMany({
      select: { total: true },
    }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  return { productCount, orderCount, customerCount, revenue };
}

async function getRecentOrders() {
  return prisma.order.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
}

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING: { label: "In afwachting", className: "bg-yellow-100 text-yellow-800" },
  PROCESSING: { label: "In verwerking", className: "bg-blue-100 text-blue-800" },
  SHIPPED: { label: "Verzonden", className: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Afgeleverd", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Geannuleerd", className: "bg-red-100 text-red-800" },
};

export default async function AdminDashboard() {
  const [stats, recentOrders] = await Promise.all([
    getStats(),
    getRecentOrders(),
  ]);

  const statCards = [
    {
      label: "Omzet",
      value: formatPrice(stats.revenue),
      icon: Euro,
      color: "text-emerald",
      bg: "bg-emerald/10",
    },
    {
      label: "Bestellingen",
      value: stats.orderCount.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Producten",
      value: stats.productCount.toString(),
      icon: Package,
      color: "text-gold",
      bg: "bg-gold/10",
    },
    {
      label: "Klanten",
      value: stats.customerCount.toString(),
      icon: Users,
      color: "text-burgundy",
      bg: "bg-burgundy/10",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
        Dashboard
      </h1>
      <p className="mt-2 text-muted-foreground">
        Welkom in het beheerpaneel van Layali
      </p>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-white p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
          Recente bestellingen
        </h2>
        <div className="mt-4 rounded-2xl border border-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                    Bestelling
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                    Klant
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                    Totaal
                  </th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      Nog geen bestellingen
                    </td>
                  </tr>
                )}
                {recentOrders.map((order) => {
                  const statusInfo = statusLabels[order.status] ?? {
                    label: order.status,
                    className: "bg-gray-100 text-gray-800",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">
                            {order.user.name ?? "Onbekend"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.user.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("nl-BE")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
