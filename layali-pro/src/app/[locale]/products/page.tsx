import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters from "@/components/products/ProductFilters";

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    sort?: string;
    featured?: string;
    bestseller?: string;
    sale?: string;
    gender?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const t = await getTranslations("products");

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.search) where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
  if (params.category) where.category = { slug: params.category };
  if (params.featured === "true") where.featured = true;
  if (params.bestseller === "true") where.bestSeller = true;
  if (params.sale === "true") where.comparePrice = { not: null };
  if (params.gender) where.gender = params.gender;
  if (params.minPrice || params.maxPrice) {
    where.price = {};
    if (params.minPrice) (where.price as Record<string, number>).gte = parseFloat(params.minPrice);
    if (params.maxPrice) (where.price as Record<string, number>).lte = parseFloat(params.maxPrice);
  }

  const orderBy: Record<string, string> = {};
  switch (params.sort) {
    case "price_asc": orderBy.price = "asc"; break;
    case "price_desc": orderBy.price = "desc"; break;
    default: orderBy.createdAt = "desc";
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where, include: { category: { select: { id: true, name: true, slug: true } } }, orderBy }),
    prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" } }),
  ]);

  const activeCategory = params.category ? categories.find((c: { slug: string }) => c.slug === params.category) : null;
  const title = params.search
    ? `"${params.search}"`
    : params.bestseller === "true"
    ? t("titleBestsellers")
    : params.sale === "true"
    ? t("titleSale")
    : params.sort === "newest" || params.featured === "true"
    ? (params.featured === "true" ? t("titleFeatured") : t("titleNew"))
    : activeCategory?.name || t("title");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t("home")}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{products.length} {products.length === 1 ? "product" : "producten"}</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64">
          <ProductFilters categories={categories} currentCategory={params.category} currentSort={params.sort} />
        </aside>
        <div className="flex-1">
          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-24 text-center">
              <p className="text-lg font-medium">{t("noResults")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("noResultsDesc")}</p>
              <Link href="/products" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-terracotta-dark">
                {t("clearFilters")}
              </Link>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  );
}
