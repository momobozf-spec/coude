import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";

async function getProduct(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

async function getCategories() {
  return prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    getProduct(id),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
        Product bewerken
      </h1>
      <p className="mt-2 text-muted-foreground">{product.name}</p>

      <div className="mt-8">
        <ProductForm
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.price,
            comparePrice: product.comparePrice,
            images: product.images,
            sizes: product.sizes,
            colors: product.colors,
            stock: product.stock,
            categoryId: product.categoryId,
            featured: product.featured,
            badge: product.badge ?? "",
            status: product.status,
          }}
          categories={categories}
        />
      </div>
    </div>
  );
}
