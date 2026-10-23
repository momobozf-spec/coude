"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User, Menu, X, Heart, ChevronDown, ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import TopBar from "@/components/layout/TopBar";
import AtmosphereTile from "@/components/ui/AtmosphereTile";

/** Themed category groups for the mega menu (slug + i18n key). */
const MEGA_GROUPS: { titleKey: string; items: { slug: string; key: string }[] }[] = [
  {
    titleKey: "living",
    items: [
      { slug: "home-decor", key: "homeDecor" },
      { slug: "candles-lanterns", key: "candlesLanterns" },
      { slug: "cushions-textiles", key: "cushionsTextiles" },
    ],
  },
  {
    titleKey: "table",
    items: [
      { slug: "tea-experience", key: "teaExperience" },
      { slug: "tableware", key: "tableware" },
      { slug: "kitchen-serving", key: "kitchenServing" },
    ],
  },
  {
    titleKey: "wellness",
    items: [
      { slug: "fragrance", key: "fragrance" },
      { slug: "hammam-wellness", key: "hammamWellness" },
    ],
  },
  {
    titleKey: "gifting",
    items: [
      { slug: "gifts", key: "gifts" },
      { slug: "wedding-henna", key: "weddingHenna" },
      { slug: "seasonal", key: "seasonal" },
    ],
  },
];

export default function Header() {
  const t = useTranslations();
  const { data: session } = useSession();
  const totalItems = useCartStore((s) => s.totalItems);
  const openCart = useCartStore((s) => s.openCart);
  const wishlistIds = useWishlistStore((s) => s.ids);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cartCount = mounted ? totalItems() : 0;
  const wishCount = mounted ? wishlistIds.length : 0;

  const quickLinks = [
    { label: t("nav.new"), href: "/products?sort=newest" },
    { label: t("nav.services"), href: "/services" },
    { label: t("nav.vendors"), href: "/vendors" },
    { label: t("nav.gifts"), href: "/products?category=gifts" },
    { label: t("nav.sale"), href: "/products?sale=true", accent: true },
  ];

  const switchLocale = () => router.replace(pathname, { locale: locale === "nl" ? "fr" : "nl" });

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-shadow duration-300",
          scrolled ? "bg-cream/95 backdrop-blur-xl shadow-soft border-b border-border" : "bg-cream border-b border-transparent"
        )}
      >
        <TopBar />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <button className="lg:hidden p-2 -ml-2 cursor-pointer" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo */}
            <Link href="/" className="flex flex-col items-center leading-none lg:items-start">
              <span className="text-2xl font-bold tracking-[0.18em] uppercase font-[family-name:var(--font-heading)] text-emerald">
                {brand.name}
              </span>
              <span className="hidden text-[10px] tracking-[0.3em] text-muted-foreground sm:block">ORIENTAL LIFESTYLE</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {/* Mega menu trigger */}
              <div
                className="relative"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                <button className="flex items-center gap-1 text-sm font-medium text-secondary hover:text-emerald transition-colors cursor-pointer py-2">
                  {t("nav.collections")}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", megaOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {megaOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute left-1/2 top-full z-50 w-[760px] -translate-x-1/2 pt-3"
                    >
                      <div className="grid grid-cols-4 gap-6 rounded-2xl border border-border bg-cream p-6 shadow-card">
                        {MEGA_GROUPS.map((group) => (
                          <div key={group.titleKey}>
                            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-caramel">
                              {t(`megamenu.${group.titleKey}`)}
                            </h4>
                            <ul className="space-y-2">
                              {group.items.map((item) => (
                                <li key={item.slug}>
                                  <Link
                                    href={`/products?category=${item.slug}`}
                                    className="text-sm text-muted-foreground hover:text-emerald transition-colors"
                                  >
                                    {t(`categories.${item.key}`)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <div className="col-span-4 mt-1 flex items-center justify-between border-t border-border pt-4">
                          <Link href="/products" className="flex items-center gap-1.5 text-sm font-medium text-emerald hover:text-terracotta-dark transition-colors">
                            {t("megamenu.all")}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <Link href="/products?category=gifts" className="relative flex h-16 w-64 items-center overflow-hidden rounded-xl">
                            <AtmosphereTile seed="megamenu-gifts" label="" category="gifts" showLabel={false} />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                            <span className="relative z-10 px-4 font-[family-name:var(--font-serif)] text-base text-white">{t("megamenu.featured")}</span>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    link.accent ? "text-burgundy hover:text-burgundy/80" : "text-secondary hover:text-emerald"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-0.5">
              <Link href="/sell" className="mr-1 hidden rounded-full border border-emerald/40 px-3.5 py-1.5 text-xs font-semibold text-emerald transition-colors hover:bg-emerald hover:text-white xl:inline-block">
                {t("nav.sell")}
              </Link>
              <button onClick={switchLocale} className="px-2.5 py-2 rounded-full hover:bg-muted transition-colors cursor-pointer text-xs font-semibold uppercase">
                {locale === "nl" ? "FR" : "NL"}
              </button>
              <button onClick={() => setSearchOpen(!searchOpen)} className="p-2.5 rounded-full hover:bg-muted transition-colors cursor-pointer" aria-label={t("common.search")}>
                <Search className="h-5 w-5" />
              </button>
              <Link href="/account/wishlist" className="relative hidden p-2.5 rounded-full hover:bg-muted transition-colors sm:flex" aria-label={t("account.wishlist")}>
                <Heart className="h-5 w-5" />
                {wishCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-burgundy text-[9px] font-bold text-white">{wishCount}</span>
                )}
              </Link>
              <Link href={session ? "/account" : "/login"} className="p-2.5 rounded-full hover:bg-muted transition-colors" aria-label={t("common.account")}>
                <User className="h-5 w-5" />
              </Link>
              <button onClick={openCart} className="relative p-2.5 rounded-full hover:bg-muted transition-colors cursor-pointer" aria-label={t("common.cart")}>
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald text-[10px] font-bold text-white">
                    {cartCount}
                  </motion.span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border overflow-hidden">
              <form action={`/${locale}/products`} className="mx-auto max-w-2xl px-4 py-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input name="search" autoFocus placeholder={t("common.search")} className="w-full h-12 rounded-full border border-border bg-white pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="relative h-full w-80 max-w-[85vw] overflow-y-auto bg-cream p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold tracking-[0.18em] uppercase font-[family-name:var(--font-heading)] text-emerald">{brand.name}</span>
                <button onClick={() => setMobileOpen(false)} className="p-2 cursor-pointer"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-6 flex flex-col gap-1">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={cn("py-2.5 text-lg font-medium font-[family-name:var(--font-heading)]", link.accent ? "text-burgundy" : "")}>
                    {link.label}
                  </Link>
                ))}
              </div>

              <hr className="my-4 border-border" />

              {MEGA_GROUPS.map((group) => (
                <div key={group.titleKey} className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-caramel">{t(`megamenu.${group.titleKey}`)}</p>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((item) => (
                      <Link key={item.slug} href={`/products?category=${item.slug}`} onClick={() => setMobileOpen(false)} className="text-sm text-muted-foreground">
                        {t(`categories.${item.key}`)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <hr className="my-4 border-border" />
              <Link href="/services" onClick={() => setMobileOpen(false)} className="block py-2 text-base font-medium">{t("nav.services")}</Link>
              <Link href="/vendors" onClick={() => setMobileOpen(false)} className="block py-2 text-base font-medium">{t("nav.vendors")}</Link>
              <Link href="/sell" onClick={() => setMobileOpen(false)} className="block py-2 text-base font-medium text-emerald">{t("nav.sell")}</Link>

              <hr className="my-4 border-border" />
              <Link href={session ? "/account" : "/login"} onClick={() => setMobileOpen(false)} className="block py-2 text-base font-medium">
                {session ? t("common.account") : t("common.login")}
              </Link>
              <Link href="/account/wishlist" onClick={() => setMobileOpen(false)} className="block py-2 text-base font-medium">
                {t("account.wishlist")}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
