import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Package } from "lucide-react";
import Link from "next/link";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string };

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: true, slug: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Order History</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-4">
            No orders yet
          </p>
          <Link
            href="/products"
            className="text-sm font-medium underline"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-border overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-muted/30">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Order</p>
                    <p className="font-medium">
                      #{order.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{formatPrice(order.total)}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
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

              <div className="divide-y divide-border">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 sm:p-6"
                  >
                    <div className="h-16 w-16 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1">
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="font-medium text-sm">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
