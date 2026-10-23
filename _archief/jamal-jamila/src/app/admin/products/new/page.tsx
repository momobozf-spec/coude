import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";

async function getCategories() {
  return prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
        Nieuw product
      </h1>
      <p className="mt-2 text-muted-foreground">
        Voeg een nieuw product toe aan de catalogus
      </p>

      <div className="mt-8">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
