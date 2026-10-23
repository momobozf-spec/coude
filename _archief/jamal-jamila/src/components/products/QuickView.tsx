"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Check, Minus, Plus, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import ProductBadge from "@/components/ui/ProductBadge";
import WishlistButton from "@/components/products/WishlistButton";
import type { ProductWithCategory } from "@/types";

/**
 * QuickView — lightweight modal preview of a product (atmosphere image,
 * variants, quantity, add-to-cart) opened from a product card without leaving
 * the listing.
 */
export default function QuickView({
  product,
  open,
  onClose,
}: {
  product: ProductWithCategory;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("products");
  const addItem = useCartStore((s) => s.addItem);
  const [color, setColor] = useState(product.colors[0] || "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;
  const soldOut = product.stock <= 0;

  const handleAdd = () => {
    addItem({
      id: `${product.id}-${color}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: "",
      quantity: qty,
      color,
      stock: product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            className="relative grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-3xl bg-cream shadow-card sm:grid-cols-2"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm hover:bg-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Image */}
            <div className="relative aspect-square sm:aspect-auto">
              <AtmosphereTile seed={product.slug} label={product.name} category={product.category.slug} showLabel={false} />
              <div className="absolute left-3 top-3">
                <ProductBadge badge={product.badge} discount={discount} soldOut={soldOut} />
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-col p-6 sm:p-8">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.category.name}</p>
              <h2 className="mt-1.5 font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight">{product.name}</h2>

              <div className="mt-3 flex items-center gap-2.5">
                <span className="text-xl font-bold">{formatPrice(product.price)}</span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
                )}
              </div>

              {product.shortDesc && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{product.shortDesc}</p>}

              {product.colors.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold">{t("color")}: <span className="font-normal text-muted-foreground">{color}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${color === c ? "border-emerald bg-emerald/10 text-emerald" : "border-border hover:border-emerald"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto pt-6">
                {!soldOut ? (
                  <>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-border">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-muted cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center text-sm">{qty}</span>
                        <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-muted cursor-pointer"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <WishlistButton productId={product.id} variant="inline" className="h-9 w-9" />
                    </div>
                    <button
                      onClick={handleAdd}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-terracotta-dark cursor-pointer"
                    >
                      {added ? <><Check className="h-4 w-4" />{t("addedToCart")}</> : <><ShoppingBag className="h-4 w-4" />{t("addToCart")}</>}
                    </button>
                  </>
                ) : (
                  <p className="rounded-full bg-muted px-6 py-3 text-center text-sm font-medium text-muted-foreground">{t("outOfStock")}</p>
                )}
                <Link
                  href={`/products/${product.slug}`}
                  className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-secondary hover:text-emerald transition-colors"
                  onClick={onClose}
                >
                  {t("viewDetails")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
