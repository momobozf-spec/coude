"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { findProduct } from "@/data/products";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LinkButton } from "@/components/ui/Button";
import type { Product } from "@/types";

export default function WishlistPage() {
  const mounted = useMounted();
  const itemsRaw = useWishlist((s) => s.items);
  const items = mounted ? itemsRaw : [];
  const products = items
    .map((i) => findProduct(i.productId))
    .filter((p): p is Product => Boolean(p));

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
      <h1 className="font-display text-4xl text-forest-800 sm:text-5xl">
        Wat je hebt bewaard.
      </h1>
      <p className="mt-2 text-sm text-warmbrown-600">
        Geen haast — bewaar gerust wat je leuk vindt en kom er later rustig op
        terug.
      </p>

      {products.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-cream-200 bg-cream-50 px-6 py-20 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-cream-100">
            <Heart size={32} className="text-warmbrown-400" />
          </div>
          <p className="font-display text-2xl text-forest-800">
            Nog niets bewaard.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-warmbrown-500">
            Klik op het hartje bij een product om het hier te bewaren voor
            later.
          </p>
          <LinkButton href="/shop" variant="primary" className="mt-6">
            Bekijk de collectie
          </LinkButton>
        </div>
      ) : (
        <div className="mt-10">
          <ProductGrid products={products} cols={4} />
        </div>
      )}
    </section>
  );
}
