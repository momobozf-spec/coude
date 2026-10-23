import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Package, ShoppingBag, User, ArrowRight, LogOut } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; name?: string; email?: string; role?: string };

  const [orderCount, recentOrders] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    }),
  ]);

  const totalSpent = recentOrders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        {user.role === "ADMIN" && (
          <Link
            href="/admin"
            className="text-sm font-medium px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Admin Panel
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { icon: Package, label: "Total Orders", value: orderCount.toString() },
          { icon: ShoppingBag, label: "Total Spent", value: formatPrice(totalSpent) },
          { icon: User, label: "Member Since", value: "2026" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border p-6"
          >
            <stat.icon className="h-5 w-5 text-muted-foreground mb-3" />
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
            href="/dashboard/orders"
            className="text-sm font-medium flex items-center gap-1 hover:text-muted-foreground transition-colors"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No orders yet</p>
            <Link
              href="/products"
              className="mt-4 inline-flex text-sm font-medium text-foreground hover:underline"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">
                    Order #{order.id.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {formatPrice(order.total)}
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
