import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Truck, Shield, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductGrid from "@/components/products/ProductGrid";

async function getFeaturedProducts() {
  const products = await prisma.product.findMany({
    where: { featured: true, archived: false },
    include: { category: { select: { id: true, name: true, slug: true } } },
    take: 8,
    orderBy: { createdAt: "desc" },
  });
  return products;
}

async function getCategories() {
  return prisma.category.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
  });
}

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
  ]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent z-10" />
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80"
            alt="Hero"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
              New Collection 2026
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Elevate Your
              <br />
              <span className="text-muted-foreground">Everyday</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-md leading-relaxed">
              Discover our curated collection of premium products designed for
              those who appreciate quality and timeless style.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Shop Collection
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products?featured=true"
                className="inline-flex items-center gap-2 border border-border px-8 py-3.5 rounded-full text-sm font-medium hover:bg-accent transition-colors"
              >
                View Featured
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Truck,
                title: "Free Shipping",
                desc: "On orders over $150",
              },
              {
                icon: Shield,
                title: "Secure Payments",
                desc: "SSL encrypted checkout",
              },
              {
                icon: RotateCcw,
                title: "Easy Returns",
                desc: "30-day return policy",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-4 justify-center sm:justify-start"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">
              Shop by Category
            </h2>
            <p className="mt-3 text-muted-foreground">
              Browse our curated collections
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat: { id: string; name: string; slug: string; image: string | null }) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-muted"
              >
                {cat.image && (
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-white text-lg font-semibold">
                    {cat.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Featured</h2>
              <p className="mt-3 text-muted-foreground">
                Our most popular pieces
              </p>
            </div>
            <Link
              href="/products?featured=true"
              className="text-sm font-medium flex items-center gap-1 hover:text-muted-foreground transition-colors"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductGrid products={featured} />
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground px-8 py-16 sm:px-16 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Join the LUXE Experience
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto">
            Sign up for exclusive access to new arrivals, special offers, and
            insider-only discounts.
          </p>
          <form className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full h-12 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 px-5 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
            />
            <button
              type="submit"
              className="h-12 px-8 rounded-full bg-primary-foreground text-primary text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
