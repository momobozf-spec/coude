"use client";

import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "@/types";
import { useCart, useWishlist, useToast } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Price } from "@/components/ui/Price";
import { Stars } from "@/components/ui/Stars";
import { ProductBadge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ui/ProductImage";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const add = useCart((s) => s.add);
  const toggle = useWishlist((s) => s.toggle);
  const inWishlist = useWishlist((s) => s.has(product.id));
  const showToast = useToast((s) => s.show);
  const t = useT();

  return (
    <div className="group relative flex flex-col">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream-100 shadow-card transition-shadow duration-300 group-hover:shadow-warm">
          <ProductImage
            slug={product.slug}
            accent={product.imageAccent}
            alt={product.name}
            className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.03]"
          />

          {/* badges */}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.badge && <ProductBadge badge={product.badge} />}
            {product.oldPrice && (
              <span className="rounded-full bg-cream-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-warmbrown-600">
                -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
              </span>
            )}
          </div>

          {/* wishlist */}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggle(product.id);
              showToast(inWishlist ? "Niet meer bewaard" : "Bewaard voor later");
            }}
            aria-label={t("common.add_to_wishlist")}
            className={cn(
              "absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-cream-50/90 backdrop-blur transition-colors hover:bg-cream-50",
              inWishlist && "text-warmbrown-500",
            )}
          >
            <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
          </button>

          {/* stock indicator */}
          {product.stockStatus === "low_stock" && (
            <div className="absolute bottom-3 left-3 rounded-full bg-clay-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-warmbrown-600">
              Nog enkele
            </div>
          )}

          {/* hover quick add */}
          <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                add(product, 1);
                showToast(t("common.added"));
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-olive-600 text-cream-50 shadow-soft hover:bg-olive-700"
              aria-label={t("common.add_to_cart")}
            >
              <ShoppingBag size={15} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </Link>

      <div className={cn("mt-4 flex flex-col", compact && "mt-3")}>
        <div className="flex items-center gap-1.5 text-[11px] text-warmbrown-500">
          <Stars rating={product.rating} size={12} />
          <span>({product.reviewCount})</span>
        </div>
        <Link
          href={`/product/${product.slug}`}
          className="mt-1 line-clamp-2 font-display text-base leading-snug text-forest-800 hover:text-olive-600 transition-colors"
        >
          {product.name}
        </Link>
        <div className="mt-1.5 flex items-center justify-between">
          <Price amount={product.price} oldAmount={product.oldPrice} size="md" />
        </div>
      </div>
    </div>
  );
}
