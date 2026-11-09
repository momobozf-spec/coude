import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Truck, ShieldCheck, Sparkles, Gift, RotateCcw, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductGrid from "@/components/products/ProductGrid";
import CollectionCard from "@/components/products/CollectionCard";
import SectionHeader from "@/components/ui/SectionHeader";
import TrustBadge from "@/components/ui/TrustBadge";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import ServiceGrid from "@/components/services/ServiceGrid";
import VendorCard from "@/components/vendors/VendorCard";
import type { ServiceWithRelations, VendorSummary } from "@/types";

async function getProducts() {
  const [featured, bestSellers, newArrivals, popularServices, vendors] = await Promise.all([
    prisma.product.findMany({ where: { featured: true, status: "ACTIVE" }, include: { category: { select: { id: true, name: true, slug: true } } }, take: 8, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { bestSeller: true, status: "ACTIVE" }, include: { category: { select: { id: true, name: true, slug: true } } }, take: 8, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { newCollection: true, status: "ACTIVE" }, include: { category: { select: { id: true, name: true, slug: true } } }, take: 8, orderBy: { createdAt: "desc" } }),
    prisma.service.findMany({ where: { popular: true, status: "ACTIVE" }, include: { vendor: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } }, take: 6, orderBy: { createdAt: "desc" } }),
    prisma.vendor.findMany({ where: { status: "ACTIVE", featured: true }, take: 6, orderBy: { name: "asc" } }),
  ]);
  return { featured, bestSellers, newArrivals, popularServices, vendors };
}

const TESTIMONIALS = [
  { key: "t1", seed: "rev-1" },
  { key: "t2", seed: "rev-2" },
  { key: "t3", seed: "rev-3" },
] as const;

// Curated lifestyle collections → category filters.
const COLLECTIONS = [
  { key: "tea", href: "/products?category=tea-experience", seed: "col-tea", cat: "tea-experience" },
  { key: "nights", href: "/products?category=candles-lanterns", seed: "col-nights", cat: "candles-lanterns" },
  { key: "fragrance", href: "/products?category=fragrance", seed: "col-fragrance", cat: "fragrance" },
  { key: "hammam", href: "/products?category=hammam-wellness", seed: "col-hammam", cat: "hammam-wellness" },
  { key: "home", href: "/products?category=home-decor", seed: "col-home", cat: "home-decor" },
  { key: "table", href: "/products?category=tableware", seed: "col-table", cat: "tableware" },
  { key: "gifts", href: "/products?category=gifts", seed: "col-gifts", cat: "gifts" },
  { key: "seasonal", href: "/products?category=seasonal", seed: "col-seasonal", cat: "seasonal" },
] as const;

const SIGNATURE_BOXES = [
  { key: "teaBox", seed: "box-tea", cat: "tea-experience" },
  { key: "nightsBox", seed: "box-nights", cat: "candles-lanterns" },
  { key: "hammamBox", seed: "box-hammam", cat: "hammam-wellness" },
] as const;

export default async function HomePage() {
  const t = await getTranslations();
  const tCol = await getTranslations("collections");
  const { featured, bestSellers, newArrivals, popularServices, vendors } = await getProducts();

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sand via-cream to-muted">
        <div className="absolute inset-0 pattern-oriental opacity-60" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-24">
          {/* Copy */}
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-sm font-medium text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {t("hero.badge")}
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {t("hero.titleLine1")} <span className="text-gradient-gold">{t("hero.titleHighlight")}</span> {t("hero.titleLine2")}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-full bg-emerald px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-emerald/20 transition-all hover:bg-terracotta-dark">
                {t("hero.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/products?category=gifts" className="inline-flex items-center gap-2 rounded-full border border-secondary/25 px-8 py-3.5 text-sm font-medium text-secondary transition-colors hover:bg-white/60">
                {t("hero.ctaSecondary")}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-caramel" />{t("home.trustShippingDesc")}</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-caramel" />{t("home.trustSecureDesc")}</span>
              <span className="flex items-center gap-1.5"><Gift className="h-4 w-4 text-caramel" />{t("home.trustGiftDesc")}</span>
            </div>
          </div>

          {/* Lookbook collage */}
          <div className="hidden grid-cols-2 gap-4 lg:grid">
            <div className="relative aspect-[3/4] translate-y-6 overflow-hidden rounded-3xl shadow-card">
              <AtmosphereTile seed="hero-a" label={tCol("tea")} category="tea-experience" glyphClassName="h-1/3 w-1/3" />
            </div>
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-3xl shadow-card">
                <AtmosphereTile seed="hero-b" label={tCol("nights")} category="candles-lanterns" glyphClassName="h-1/3 w-1/3" />
              </div>
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-card">
                <AtmosphereTile seed="hero-c" label={tCol("hammam")} category="hammam-wellness" glyphClassName="h-1/3 w-1/3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Trust strip */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
          <TrustBadge icon={Truck} title={t("home.trustShipping")} desc={t("home.trustShippingDesc")} />
          <TrustBadge icon={ShieldCheck} title={t("home.trustSecure")} desc={t("home.trustSecureDesc")} />
          <TrustBadge icon={Sparkles} title={t("home.trustHandmade")} desc={t("home.trustHandmadeDesc")} />
          <TrustBadge icon={Gift} title={t("home.trustGift")} desc={t("home.trustGiftDesc")} />
        </div>
      </section>

      {/* ---------------------------------------------------------- Collections */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader eyebrow={t("home.collectionsEyebrow")} title={t("home.collectionsTitle")} subtitle={t("home.collectionsSubtitle")} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <CollectionCard key={c.key} title={tCol(c.key)} desc={tCol(`${c.key}Desc`)} href={c.href} seed={c.seed} category={c.cat} cta={t("common.discover")} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ New arrivals */}
      {newArrivals.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader align="between" eyebrow={t("home.newEyebrow")} title={t("home.newTitle")} subtitle={t("home.newSubtitle")} viewAllHref="/products?sort=newest" viewAllLabel={t("common.viewAll")} />
            <ProductGrid products={newArrivals} />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Bestsellers */}
      {bestSellers.length > 0 && (
        <section className="pattern-oriental">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader align="between" eyebrow={t("home.bestsellersEyebrow")} title={t("home.bestsellersTitle")} subtitle={t("home.bestsellersSubtitle")} viewAllHref="/products?bestseller=true" viewAllLabel={t("common.viewAll")} />
            <ProductGrid products={bestSellers} />
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Popular services */}
      {popularServices.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader align="between" eyebrow={t("home.servicesEyebrow")} title={t("home.servicesTitle")} subtitle={t("home.servicesSubtitle")} viewAllHref="/services" viewAllLabel={t("common.viewAll")} />
            <ServiceGrid services={popularServices as unknown as ServiceWithRelations[]} />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Vendors */}
      {vendors.length > 0 && (
        <section className="pattern-oriental">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader align="between" eyebrow={t("home.vendorsEyebrow")} title={t("home.vendorsTitle")} subtitle={t("home.vendorsSubtitle")} viewAllHref="/vendors" viewAllLabel={t("common.viewAll")} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <VendorCard key={v.id} vendor={v as unknown as VendorSummary} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Signature boxes */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">{t("home.giftBoxesEyebrow")}</span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.giftBoxesTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">{t("home.giftBoxesSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {SIGNATURE_BOXES.map((b) => (
              <Link key={b.key} href="/products?category=gifts" className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                    <AtmosphereTile seed={b.seed} label="" category={b.cat} showLabel={false} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg font-semibold">{t(`home.${b.key}`)}</h3>
                <p className="mt-1 text-sm text-white/65">{t(`home.${b.key}Desc`)}</p>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/products?category=gifts" className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-secondary transition-colors hover:bg-gold-light">
              {t("home.giftBoxesCta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Featured */}
      {featured.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader align="between" eyebrow={t("home.featuredEyebrow")} title={t("home.featuredTitle")} subtitle={t("home.featuredSubtitle")} viewAllHref="/products?featured=true" viewAllLabel={t("common.viewAll")} />
            <ProductGrid products={featured} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Story */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card">
            <AtmosphereTile seed="story-oriental" label="" category="home-decor" showLabel={false} glyphClassName="h-1/4 w-1/4" />
          </div>
          <div>
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-caramel">{t("home.storyEyebrow")}</span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.storyTitle")}</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">{t("home.storyBody")}</p>
            <div className="mt-7 grid grid-cols-3 gap-4">
              {[
                { icon: Sparkles, label: t("home.valueCurated") },
                { icon: Gift, label: t("home.valueGift") },
                { icon: RotateCcw, label: t("home.valueReturns") },
              ].map((v) => (
                <div key={v.label} className="flex flex-col items-center gap-2 rounded-2xl bg-muted/60 p-4 text-center">
                  <v.icon className="h-5 w-5 text-emerald" strokeWidth={1.5} />
                  <span className="text-xs leading-tight text-muted-foreground">{v.label}</span>
                </div>
              ))}
            </div>
            <Link href="/about" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-emerald hover:text-terracotta-dark transition-colors">
              {t("home.storyCta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Testimonials */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeader eyebrow={t("home.testimonialsEyebrow")} title={t("home.testimonialsTitle")} subtitle={t("home.testimonialsSubtitle")} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((rev) => (
              <figure key={rev.key} className="flex flex-col rounded-3xl border border-border bg-cream p-7 shadow-soft">
                <div className="mb-3 flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">“{t(`home.${rev.key}Quote`)}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="relative h-10 w-10 overflow-hidden rounded-full">
                    <AtmosphereTile seed={rev.seed} label="" category="seasonal" showLabel={false} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t(`home.${rev.key}Name`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`home.${rev.key}Role`)}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Newsletter */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-emerald px-8 py-16 text-center text-white pattern-zellige sm:px-16 sm:py-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.newsletterTitle")}</h2>
          <p className="mx-auto mt-4 max-w-lg text-white/80">{t("home.newsletterSubtitle")}</p>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <input type="email" placeholder={t("home.newsletterPlaceholder")} className="h-12 w-full rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30" />
            <button type="submit" className="h-12 whitespace-nowrap rounded-full bg-gold px-8 text-sm font-semibold text-secondary transition-colors hover:bg-gold-light cursor-pointer">
              {t("home.newsletterButton")}
            </button>
          </form>
          <p className="mt-4 text-xs text-white/60">{t("home.newsletterNote")}</p>
        </div>
      </section>
    </div>
  );
}
