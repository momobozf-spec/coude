import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer orders
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-border text-muted-foreground">
          No orders yet
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
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
                    Items
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">
                        {order.user.name || "Guest"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.user.email}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {order.items.length} item
                      {order.items.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <OrderStatusSelect
                        orderId={order.id}
                        currentStatus={order.status}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
