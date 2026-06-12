"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ShoppingBag, Eye, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { colorSwatch } from "@/lib/colors";
import { useCartStore } from "@/store/cart";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import ProductBadge from "@/components/ui/ProductBadge";
import WishlistButton from "@/components/products/WishlistButton";
import QuickView from "@/components/products/QuickView";
import type { ProductWithCategory } from "@/types";

export default function ProductCard({ product, index = 0 }: { product: ProductWithCategory; index?: number }) {
  const t = useTranslations("products");
  const addItem = useCartStore((s) => s.addItem);
  const [quickOpen, setQuickOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;
  const soldOut = product.stock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    addItem({
      id: `${product.id}-default`,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: "",
      quantity: 1,
      stock: product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const openQuick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      >
        <Link href={`/products/${product.slug}`} className="group block">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-soft">
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
              <AtmosphereTile seed={product.slug} label={product.name} category={product.category.slug} />
            </div>

            {/* Badges */}
            <div className="absolute left-3 top-3 z-10">
              <ProductBadge badge={product.badge} discount={discount} soldOut={soldOut} />
            </div>

            {/* Wishlist + quick view */}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <WishlistButton productId={product.id} />
              <button
                onClick={openQuick}
                aria-label={t("quickView")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm transition-all hover:bg-white hover:scale-105 cursor-pointer"
              >
                <Eye className="h-4 w-4 text-secondary" />
              </button>
            </div>

            {/* Quick add */}
            {!soldOut && (
              <button
                onClick={handleAddToCart}
                className="absolute inset-x-3 bottom-3 z-10 flex translate-y-3 items-center justify-center gap-2 rounded-xl bg-emerald/95 py-2.5 text-sm font-medium text-white opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-terracotta-dark group-hover:translate-y-0 group-hover:opacity-100 cursor-pointer"
              >
                {added ? <><Check className="h-4 w-4" />{t("addedToCart")}</> : <><ShoppingBag className="h-4 w-4" />{t("addToCart")}</>}
              </button>
            )}
          </div>

          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{product.category.name}</p>
            <h3 className="text-sm font-medium leading-snug transition-colors group-hover:text-emerald">{product.name}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <span className="text-xs text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
                )}
              </div>
              {product.colors.length > 0 && (
                <div className="flex items-center gap-1">
                  {product.colors.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: colorSwatch(c) }}
                    />
                  ))}
                  {product.colors.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{product.colors.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Link>
      </motion.div>

      <QuickView product={product} open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}
