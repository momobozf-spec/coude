"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  RefreshCw,
  ShieldCheck,
  Gift,
  ChevronRight,
} from "lucide-react";
import { findProduct, relatedProducts } from "@/data/products";
import { reviewsForProduct } from "@/data/reviews";
import { findCategory } from "@/data/categories";
import { useCart, useWishlist, useToast } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Price } from "@/components/ui/Price";
import { Stars } from "@/components/ui/Stars";
import { ProductBadge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ui/ProductImage";
import { Button } from "@/components/ui/Button";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ReviewCard } from "@/components/product/ReviewCard";
import { TrustBadges } from "@/components/product/TrustBadges";

export default function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = findProduct(params.slug);
  if (!product) notFound();

  const category = findCategory(product.category);
  const related = relatedProducts(product.id);
  const productReviews = reviewsForProduct(product.id);

  const add = useCart((s) => s.add);
  const toggleWishlist = useWishlist((s) => s.toggle);
  const inWishlist = useWishlist((s) => s.has(product.id));
  const showToast = useToast((s) => s.show);
  const t = useT();

  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "inside" | "shipping">("desc");

  return (
    <>
      {/* Breadcrumbs */}
      <nav className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 pt-6 text-xs text-warmbrown-500 lg:px-6">
        <Link href="/" className="hover:text-forest-700">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-forest-700">Shop</Link>
        {category && (
          <>
            <ChevronRight size={12} />
            <Link href={`/shop?category=${category.id}`} className="hover:text-forest-700">
              {category.name}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-forest-700">{product.name}</span>
      </nav>

      {/* Product detail */}
      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="relative overflow-hidden rounded-3xl bg-cream-100 shadow-luxe">
              <ProductImage
                slug={product.slug}
                accent={product.imageAccent}
                alt={product.name}
                className="aspect-square"
              />
              <div className="absolute left-4 top-4 flex flex-col gap-1.5">
                {product.badge && <ProductBadge badge={product.badge} />}
                {product.oldPrice && (
                  <span className="rounded-full bg-cream-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-700">
                    Save {Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className="aspect-square overflow-hidden rounded-xl border-2 border-transparent bg-cream-100 transition-all hover:border-gold-300"
                >
                  <ProductImage
                    slug={`${product.slug}-${i}`}
                    accent={product.imageAccent}
                    alt={product.name}
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="lg:pl-6">
            {category && (
              <Link
                href={`/shop?category=${category.id}`}
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-warmbrown-600 hover:text-forest-700"
              >
                {category.name}
              </Link>
            )}
            <h1 className="mt-2 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
              {product.name}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <Stars rating={product.rating} size={16} />
              <span className="text-warmbrown-500">
                <span className="text-forest-700 font-medium">{product.rating}</span> · {product.reviewCount} ervaringen
              </span>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
              <Price amount={product.price} oldAmount={product.oldPrice} size="lg" />
              {product.stockStatus === "low_stock" && (
                <span className="rounded-full bg-clay-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-warmbrown-600">
                  Nog enkele beschikbaar
                </span>
              )}
            </div>

            <p className="mt-5 text-base leading-relaxed text-warmbrown-600">
              {product.description}
            </p>

            {/* Quantity + actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-cream-300 bg-cream-50">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease"
                  className="grid h-12 w-12 place-items-center text-forest-700 hover:bg-cream-100 rounded-l-full"
                >
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center text-base font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="Increase"
                  className="grid h-12 w-12 place-items-center text-forest-700 hover:bg-cream-100 rounded-r-full"
                >
                  <Plus size={14} />
                </button>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  add(product, qty);
                  showToast(t("common.added"));
                }}
                className="flex-1"
              >
                <ShoppingBag size={16} />
                {t("common.add_to_cart")}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  toggleWishlist(product.id);
                  showToast(inWishlist ? "Niet meer bewaard" : "Bewaard voor later");
                }}
                aria-label="Bewaar"
                className="!px-4"
              >
                <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-6">
              <TrustBadges variant="compact" />
            </div>

            {/* Tabs */}
            <div className="mt-8 border-t border-cream-200 pt-6">
              <div className="flex gap-1 border-b border-cream-200">
                {[
                  { id: "desc", label: "Beschrijving" },
                  { id: "inside", label: "Wat zit erin" },
                  { id: "shipping", label: "Verzending & retour" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as typeof tab)}
                    className={
                      tab === t.id
                        ? "border-b-2 border-forest-700 px-4 py-3 text-sm font-medium text-forest-800"
                        : "border-b-2 border-transparent px-4 py-3 text-sm text-warmbrown-500 hover:text-forest-700"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="py-5 text-sm leading-relaxed text-warmbrown-600">
                {tab === "desc" && <p>{product.longDescription}</p>}
                {tab === "inside" && (
                  <ul className="grid gap-2">
                    {product.whatsInside.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-300" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {tab === "shipping" && (
                  <div className="grid gap-4">
                    <div className="flex gap-3">
                      <Truck size={18} strokeWidth={1.6} className="mt-0.5 flex-shrink-0 text-olive-600" />
                      <div>
                        <p className="font-medium text-forest-800">Verzending wereldwijd</p>
                        <p className="mt-0.5">
                          {product.shippingNote ||
                            "Verzonden vanuit Antwerpen. Binnen de EU 3-5 werkdagen, wereldwijd 5-10 werkdagen."}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <RefreshCw size={18} strokeWidth={1.6} className="mt-0.5 flex-shrink-0 text-olive-600" />
                      <div>
                        <p className="font-medium text-forest-800">14 dagen retour</p>
                        <p className="mt-0.5">
                          {product.returnNote ||
                            "Gratis retourneren binnen 14 dagen, voor ongeopende producten."}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <ShieldCheck size={18} strokeWidth={1.6} className="mt-0.5 flex-shrink-0 text-olive-600" />
                      <div>
                        <p className="font-medium text-forest-800">Veilig betalen</p>
                        <p className="mt-0.5">
                          Versleutelde betaling. Bancontact, iDEAL, Visa, Mastercard, PayPal of Apple Pay.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Gift size={18} strokeWidth={1.6} className="mt-0.5 flex-shrink-0 text-olive-600" />
                      <div>
                        <p className="font-medium text-forest-800">Met liefde verpakt</p>
                        <p className="mt-0.5">
                          Elk pakje wordt rustig ingepakt, met een handgeschreven kaartje als je dat wenst.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      {productReviews.length > 0 && (
        <section className="border-y border-cream-200 bg-cream-100/60 py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <h2 className="font-display text-3xl text-forest-800 sm:text-4xl">
              Wat anderen ervoeren
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {productReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <h2 className="mb-8 font-display text-3xl text-forest-800 sm:text-4xl">
            Misschien past dit er ook bij
          </h2>
          <ProductGrid products={related} cols={4} />
        </section>
      )}
    </>
  );
}
