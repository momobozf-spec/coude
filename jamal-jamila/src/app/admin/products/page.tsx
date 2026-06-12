import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DeleteProductButton from "./DeleteProductButton";

async function getProducts() {
  return prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });
}

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Concept", className: "bg-gray-100 text-gray-800" },
  ACTIVE: { label: "Actief", className: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Gearchiveerd", className: "bg-yellow-100 text-yellow-800" },
};

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
            Producten
          </h1>
          <p className="mt-2 text-muted-foreground">
            {products.length} product{products.length !== 1 && "en"} in totaal
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-emerald text-white px-6 h-11 text-sm font-medium hover:bg-emerald/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nieuw product
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Product
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Categorie
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Prijs
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Voorraad
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    Nog geen producten. Voeg je eerste product toe.
                  </td>
                </tr>
              )}
              {products.map((product) => {
                const statusInfo = statusLabels[product.status] ?? {
                  label: product.status,
                  className: "bg-gray-100 text-gray-800",
                };
                return (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {product.images[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.badge && (
                            <span className="inline-flex items-center rounded-full bg-gold/10 text-gold px-2 py-0.5 text-[10px] font-semibold mt-0.5">
                              {product.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {product.category.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {formatPrice(product.price)}
                      {product.comparePrice && (
                        <span className="block text-xs text-muted-foreground line-through">
                          {formatPrice(product.comparePrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={
                          product.stock <= 5
                            ? "text-destructive font-medium"
                            : ""
                        }
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors"
                          title="Bewerken"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <DeleteProductButton productId={product.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
