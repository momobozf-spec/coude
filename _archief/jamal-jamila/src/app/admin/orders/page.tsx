import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";

async function getOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
        Bestellingen
      </h1>
      <p className="mt-2 text-muted-foreground">
        {orders.length} bestelling{orders.length !== 1 && "en"} in totaal
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-white overflow-hidden">
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
                  Producten
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
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    Nog geen bestellingen
                  </td>
                </tr>
              )}
              {orders.map((order) => (
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
                    <div className="space-y-0.5">
                      {order.items.slice(0, 2).map((item) => (
                        <p key={item.id} className="text-xs text-muted-foreground">
                          {item.quantity}x {item.product.name}
                        </p>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{order.items.length - 2} meer
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <OrderStatusSelect
                      orderId={order.id}
                      currentStatus={order.status}
                    />
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("nl-BE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
