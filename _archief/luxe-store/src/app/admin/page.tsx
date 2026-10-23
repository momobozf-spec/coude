import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [productCount, orderCount, userCount, orders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true, email: true } },
        items: { select: { quantity: true } },
      },
    }),
  ]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      label: "Total Revenue",
      value: formatPrice(totalRevenue),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Orders",
      value: orderCount.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Products",
      value: productCount.toString(),
      icon: Package,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Customers",
      value: userCount.toString(),
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your store performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}
              >
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold text-lg">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium flex items-center gap-1 hover:text-muted-foreground transition-colors"
          >
            View All
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No orders yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {order.user.name || order.user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          order.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : order.status === "SHIPPED"
                            ? "bg-blue-100 text-blue-800"
                            : order.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
