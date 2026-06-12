"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Search, Heart, ShoppingBag, Menu, User, X } from "lucide-react";
import { useCart, useWishlist } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useMounted } from "@/lib/useMounted";
import { LanguageCurrencySelector } from "@/components/ui/LanguageCurrencySelector";
import MobileMenu from "@/components/layout/MobileMenu";
import { products } from "@/data/products";
import { cn } from "@/lib/utils";

export default function Header() {
  const mounted = useMounted();
  const cartCountRaw = useCart((s) => s.count());
  const openCart = useCart((s) => s.openDrawer);
  const wishCountRaw = useWishlist((s) => s.count());
  const cartCount = mounted ? cartCountRaw : 0;
  const wishCount = mounted ? wishCountRaw : 0;
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const results = query
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  return (
    <>
      {/* Top announcement bar */}
      <div className="bg-olive-700 text-cream-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[11px] tracking-wide sm:text-xs">
          <span className="hidden md:inline opacity-75">
            Verzending wereldwijd · gratis vanaf €100
          </span>
          <span className="text-center text-cream-100/90">
            Voor Eid al-Adha · met liefde verpakt door ons gezin
          </span>
          <div className="hidden md:flex items-center gap-3">
            <LanguageCurrencySelector variant="dark" />
          </div>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b border-cream-200 bg-cream-50/95 backdrop-blur transition-all",
          scrolled ? "shadow-soft" : "",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            className="lg:hidden text-forest-700 p-2 -ml-2"
          >
            <Menu size={22} />
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex flex-col items-center gap-0 text-center lg:flex-row lg:gap-2"
          >
            <span className="font-display text-2xl font-medium tracking-wide text-forest-800">
              Bayt <span className="text-warmbrown-500">Noor</span>
            </span>
            <span className="hidden text-[9px] uppercase tracking-[0.35em] text-warmbrown-400 lg:block">
              Familie · Eid
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-7 text-sm font-medium tracking-wide text-forest-700 lg:flex">
            <Link href="/shop" className="hover:text-gold-400 transition-colors">
              {t("nav.shop")}
            </Link>
            <Link href="/gift-boxes" className="hover:text-gold-400 transition-colors">
              {t("nav.gift_boxes")}
            </Link>
            <Link href="/collections" className="hover:text-gold-400 transition-colors">
              {t("nav.collections")}
            </Link>
            <Link href="/about" className="hover:text-gold-400 transition-colors">
              {t("nav.about")}
            </Link>
            <Link href="/contact" className="hover:text-gold-400 transition-colors">
              {t("nav.contact")}
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              className="rounded-full p-2 text-forest-700 hover:bg-cream-100"
            >
              <Search size={20} />
            </button>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden sm:block rounded-full p-2 text-forest-700 hover:bg-cream-100"
            >
              <User size={20} />
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="relative rounded-full p-2 text-forest-700 hover:bg-cream-100"
            >
              <Heart size={20} />
              {wishCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-300 px-1 text-[10px] font-semibold text-forest-800">
                  {wishCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => openCart()}
              aria-label="Cart"
              className="relative rounded-full p-2 text-forest-700 hover:bg-cream-100"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-forest-700 px-1 text-[10px] font-semibold text-cream-50">
                  {cartCount}
                </span>
              )}
            </button>
            <div className="lg:hidden">
              <LanguageCurrencySelector />
            </div>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && (
          <div className="border-t border-cream-200 bg-cream-50 animate-fade-in">
            <div className="mx-auto max-w-3xl px-4 py-6">
              <div className="flex items-center gap-3 rounded-full border border-cream-300 bg-white px-5 py-3">
                <Search size={18} className="text-warmbrown-500" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Zoek naar dadels, parfum, geschenken..."
                  className="flex-1 bg-transparent text-sm placeholder:text-warmbrown-400 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="text-warmbrown-500 hover:text-forest-700"
                  aria-label="Close search"
                >
                  <X size={18} />
                </button>
              </div>
              {query && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
                  {results.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-warmbrown-500">
                      We hebben niets gevonden voor &quot;{query}&quot;.
                    </p>
                  ) : (
                    results.map((p) => (
                      <Link
                        key={p.id}
                        href={`/product/${p.slug}`}
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                        }}
                        className="flex items-center gap-4 border-b border-cream-100 px-5 py-3 last:border-0 hover:bg-cream-50"
                      >
                        <div
                          className="h-10 w-10 rounded-md"
                          style={{ background: `${p.imageAccent}20` }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-forest-800">{p.name}</p>
                          <p className="text-xs text-warmbrown-500">{p.description}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </>
  );
}
