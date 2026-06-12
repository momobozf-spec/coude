import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add Product</h1>
        <p className="text-muted-foreground mt-1">
          Create a new product for your store
        </p>
      </div>
      <ProductForm categories={categories} />
    </div>
  );
}
