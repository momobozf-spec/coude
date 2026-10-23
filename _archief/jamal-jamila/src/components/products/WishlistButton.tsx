"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlist";
import { cn } from "@/lib/utils";

/**
 * WishlistButton — heart toggle backed by the client wishlist store.
 * `variant="floating"` is the circular button used on product cards;
 * `variant="inline"` is the bordered button used on the product detail page.
 */
export default function WishlistButton({
  productId,
  variant = "floating",
  className,
}: {
  productId: string;
  variant?: "floating" | "inline";
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const ids = useWishlistStore((s) => s.ids);
  const toggle = useWishlistStore((s) => s.toggle);
  useEffect(() => setMounted(true), []);

  const active = mounted && ids.includes(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(productId);
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Bewaar als favoriet"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer",
          active ? "border-emerald bg-emerald/10 text-emerald" : "border-border hover:border-emerald text-foreground",
          className
        )}
      >
        <Heart className={cn("h-5 w-5", active && "fill-emerald")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Bewaar als favoriet"
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm transition-all hover:bg-white hover:scale-105 cursor-pointer",
        className
      )}
    >
      <Heart className={cn("h-4 w-4 transition-colors", active ? "fill-burgundy text-burgundy" : "text-secondary")} />
    </button>
  );
}
