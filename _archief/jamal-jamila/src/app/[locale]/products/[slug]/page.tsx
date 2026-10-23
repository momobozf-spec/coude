import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import ProductDetail from "@/components/products/ProductDetail";
import ProductGrid from "@/components/products/ProductGrid";

interface ProductPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: "Product niet gevonden" };
  const desc = product.seoDescription || product.shortDesc || product.description.substring(0, 160);
  return {
    title: product.seoTitle || product.name,
    description: desc,
    alternates: { canonical: `${brand.url}/${locale}/products/${slug}` },
    openGraph: {
      title: product.seoTitle || product.name,
      description: desc,
      type: "website",
      images: product.images[0] ? [{ url: product.images[0] }] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, status: "ACTIVE" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      reviews: { where: { approved: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, status: "ACTIVE" },
    include: { category: { select: { id: true, name: true, slug: true } } },
    take: 4,
  });

  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.reviews.length
    : 0;

  // Product structured data (schema.org) for rich search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDesc || product.description.substring(0, 200),
    image: product.images,
    sku: product.sku || undefined,
    brand: { "@type": "Brand", name: brand.name },
    category: product.category.name,
    offers: {
      "@type": "Offer",
      url: `${brand.url}/products/${product.slug}`,
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.reviews.length > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating.toFixed(1),
        reviewCount: product.reviews.length,
      },
    }),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetail product={product} reviews={product.reviews} avgRating={avgRating} />
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
          <h2 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Gerelateerde producten</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
