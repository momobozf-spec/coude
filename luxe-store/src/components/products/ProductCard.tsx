"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import type { ProductWithCategory } from "@/types";

interface ProductCardProps {
  product: ProductWithCategory;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] || "/placeholder.jpg",
      quantity: 1,
      stock: product.stock,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/products/${product.slug}`} className="group block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <ShoppingBag className="h-12 w-12" />
            </div>
          )}

          {/* Sale badge */}
          {product.comparePrice && product.comparePrice > product.price && (
            <div className="absolute top-3 left-3 bg-destructive text-white text-xs font-bold px-2.5 py-1 rounded-full">
              SALE
            </div>
          )}

          {/* Quick add */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            whileHover={{ scale: 1.05 }}
            className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-medium text-center cursor-pointer"
            onClick={handleAddToCart}
          >
            Add to Cart
          </motion.button>
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {product.category.name}
          </p>
          <h3 className="font-medium text-sm group-hover:text-muted-foreground transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {formatPrice(product.price)}
            </span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(product.comparePrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
