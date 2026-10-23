import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
} from "lucide-react";

export default async function AnalyticsPage() {
  const [orders, products, users] = await Promise.all([
    prisma.order.findMany({
      select: { total: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      select: { name: true, price: true, stock: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.user.count(),
  ]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const lowStockProducts = products.filter((p) => p.stock <= 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Store performance overview
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Revenue",
            value: formatPrice(totalRevenue),
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Avg Order Value",
            value: formatPrice(avgOrderValue),
            icon: TrendingUp,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Total Orders",
            value: orders.length.toString(),
            icon: ShoppingCart,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
          {
            label: "Total Customers",
            value: users.toString(),
            icon: Users,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border p-6"
          >
            <div
              className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}
            >
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <div className="rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-lg mb-6">Order Status</h2>
          <div className="space-y-4">
            {Object.entries(statusCounts).map(([status, count]) => {
              const percentage =
                orders.length > 0
                  ? Math.round((count / orders.length) * 100)
                  : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{status}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        status === "DELIVERED"
                          ? "bg-emerald-500"
                          : status === "SHIPPED"
                          ? "bg-blue-500"
                          : status === "CANCELLED"
                          ? "bg-red-500"
                          : status === "PROCESSING"
                          ? "bg-violet-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(statusCounts).length === 0 && (
              <p className="text-muted-foreground text-sm">No data yet</p>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-lg">Low Stock Alert</h2>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              All products are well stocked
            </p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      product.stock === 0
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {product.stock === 0
                      ? "Out of stock"
                      : `${product.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
