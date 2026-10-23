import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters from "@/components/products/ProductFilters";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse our premium collection of products.",
};

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    sort?: string;
    featured?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  const where: Record<string, unknown> = { archived: false };

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.category) {
    where.category = { slug: params.category };
  }

  if (params.featured === "true") {
    where.featured = true;
  }

  if (params.minPrice || params.maxPrice) {
    where.price = {};
    if (params.minPrice)
      (where.price as Record<string, number>).gte = parseFloat(params.minPrice);
    if (params.maxPrice)
      (where.price as Record<string, number>).lte = parseFloat(params.maxPrice);
  }

  const orderBy: Record<string, string> = {};
  switch (params.sort) {
    case "price_asc":
      orderBy.price = "asc";
      break;
    case "price_desc":
      orderBy.price = "desc";
      break;
    case "newest":
      orderBy.createdAt = "desc";
      break;
    default:
      orderBy.createdAt = "desc";
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {params.search
            ? `Results for "${params.search}"`
            : params.category
            ? categories.find((c: { slug: string; name: string }) => c.slug === params.category)?.name || "Products"
            : params.featured === "true"
            ? "Featured Products"
            : "All Products"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <ProductFilters
            categories={categories}
            currentCategory={params.category}
            currentSort={params.sort}
          />
        </aside>
        <div className="flex-1">
          <ProductGrid products={products} />
        </div>
      </div>
    </div>
  );
}
