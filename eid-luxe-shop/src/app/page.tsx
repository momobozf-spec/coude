import { HeroSection } from "@/components/home/HeroSection";
import { CategoryCard } from "@/components/home/CategoryCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import { ProductGrid } from "@/components/product/ProductGrid";
import { TrustBadges } from "@/components/product/TrustBadges";
import { ReviewCard } from "@/components/product/ReviewCard";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { InstagramSection } from "@/components/home/InstagramSection";
import { EidGiftBoxesSection } from "@/components/home/EidGiftBoxesSection";
import { WhyShopSection } from "@/components/home/WhyShopSection";
import { categories } from "@/data/categories";
import { bestSellers, newArrivals, giftBoxes } from "@/data/products";
import { featuredReviews } from "@/data/reviews";

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Trust strip */}
      <section className="border-b border-cream-200 bg-cream-50">
        <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
          <TrustBadges />
        </div>
      </section>

      {/* Featured categories */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
        <SectionHeader
          eyebrow="Categorieën"
          title="Voor elk moment van Eid."
          subtitle="Van de keuken tot de gebedshoek — een rustige collectie die past bij de manier waarop families samen vieren."
          link="/shop"
          linkLabel="Alles bekijken"
          align="left"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {categories.slice(0, 6).map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* Best sellers */}
      <section className="mx-auto max-w-6xl px-4 lg:px-6">
        <SectionHeader
          eyebrow="Familie favorieten"
          title="Wat onze klanten vaak kiezen."
          subtitle="De pakketten waar onze klanten warm van werden — kleine geschenken voor mensen die er iets om geven."
          link="/shop"
          linkLabel="Alles bekijken"
          align="left"
        />
        <ProductGrid products={bestSellers().slice(0, 8)} />
      </section>

      {/* Eid Gift Boxes */}
      <div className="mt-24">
        <EidGiftBoxesSection products={giftBoxes()} />
      </div>

      {/* New arrivals */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
        <SectionHeader
          eyebrow="Net toegevoegd"
          title="Nieuw op tafel."
          link="/shop?sort=new"
          linkLabel="Bekijk nieuwe"
          align="left"
        />
        <ProductGrid products={newArrivals()} />
      </section>

      {/* Why shop */}
      <WhyShopSection />

      {/* Reviews */}
      <section className="border-y border-cream-200 bg-cream-100/60 py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="mb-10 max-w-xl">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
              Wat klanten zeggen
            </span>
            <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
              Woorden van families,
              <span className="italic text-warmbrown-600"> voor families.</span>
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredReviews().slice(0, 6).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>
      </section>

      {/* Instagram */}
      <InstagramSection />

      {/* Newsletter */}
      <NewsletterSection />
    </>
  );
}
