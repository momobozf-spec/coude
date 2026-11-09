"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Home, Compass, ShoppingBag, Package, Heart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation (hidden on lg+). Home, Explore, Cart, Orders,
 * Favorites — the Cart item opens the cart drawer instead of navigating.
 */
export default function MobileBottomNav() {
  const t = useTranslations("mobilenav");
  const pathname = usePathname();
  const totalItems = useCartStore((s) => s.totalItems);
  const openCart = useCartStore((s) => s.openCart);
  const wishlistIds = useWishlistStore((s) => s.ids);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cartCount = mounted ? totalItems() : 0;
  const wishCount = mounted ? wishlistIds.length : 0;

  const items = [
    { label: t("home"), href: "/", icon: Home },
    { label: t("explore"), href: "/products", icon: Compass },
    { label: t("orders"), href: "/account/orders", icon: Package },
    { label: t("favorites"), href: "/account/wishlist", icon: Heart, badge: wishCount },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-cream/95 backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        <Link href={items[0].href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10px]", isActive(items[0].href) ? "text-emerald" : "text-muted-foreground")}>
          <Home className="h-5 w-5" />
          {items[0].label}
        </Link>
        <Link href={items[1].href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10px]", isActive(items[1].href) ? "text-emerald" : "text-muted-foreground")}>
          <Compass className="h-5 w-5" />
          {items[1].label}
        </Link>

        {/* Cart (opens drawer) */}
        <button onClick={openCart} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-muted-foreground">
          <span className="relative">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald px-1 text-[9px] font-bold text-white">{cartCount}</span>
            )}
          </span>
          {t("cart")}
        </button>

        <Link href={items[2].href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10px]", isActive(items[2].href) ? "text-emerald" : "text-muted-foreground")}>
          <Package className="h-5 w-5" />
          {items[2].label}
        </Link>
        <Link href={items[3].href} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[10px]", isActive(items[3].href) ? "text-emerald" : "text-muted-foreground")}>
          <span className="relative">
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-burgundy px-1 text-[9px] font-bold text-white">{wishCount}</span>
            )}
          </span>
          {items[3].label}
        </Link>
      </div>
    </nav>
  );
}
