import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryCard } from "@/components/home/CategoryCard";
import { categories } from "@/data/categories";
import { ProductGrid } from "@/components/product/ProductGrid";
import { products } from "@/data/products";

const COLLECTIONS = [
  {
    id: "1001-nights",
    title: "1001 Nachten",
    eyebrow: "Verhalen, niet alleen producten",
    desc: "Geïnspireerd op de oude oosterse vertellingen — oud, amber, roos. Producten die de avond rustig maken.",
    accent: "from-olive-600 via-olive-700 to-olive-800",
    text: "text-cream-50",
  },
  {
    id: "moroccan",
    title: "Marokkaans",
    eyebrow: "Van bij oma",
    desc: "Thee, lantaarn, kessa, argan — hoe onze grootouders ons leerden voor onszelf en voor anderen te zorgen.",
    accent: "from-clay-100 via-cream-200 to-sand-200",
    text: "text-forest-800",
  },
  {
    id: "1001-nights",
    title: "Eid Essentials",
    eyebrow: "Het basisrijke",
    desc: "Dadels, decor en alles wat een Eid-tafel nodig heeft — niet meer, niet minder.",
    accent: "from-cream-200 via-cream-100 to-sand-200",
    text: "text-forest-800",
  },
];

export default function CollectionsPage() {
  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Onze collecties
          </span>
          <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800 sm:text-6xl">
            Verhalen,
            <span className="italic text-warmbrown-600"> geen producten.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-warmbrown-600">
            Elke collectie is rond een gevoel gebouwd &mdash; een herinnering,
            een traditie, een plek &mdash; vertaald naar dingen die je in handen
            kan houden.
          </p>
        </div>
      </section>

      {/* Hero collections */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.title}
              href={`/shop?category=${c.id}`}
              className={`group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-7 shadow-soft transition-shadow hover:shadow-warm ${c.accent} ${c.text}`}
            >
              <svg
                className="absolute inset-0 h-full w-full opacity-[0.06]"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern id={`coll-${c.title}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill={`url(#coll-${c.title})`} />
              </svg>
              <div className="relative">
                <span className="text-[11px] uppercase tracking-[0.22em] opacity-75">
                  {c.eyebrow}
                </span>
                <h2 className="mt-2 font-display text-3xl leading-tight">{c.title}</h2>
              </div>
              <div className="relative">
                <p className="text-sm leading-relaxed opacity-90">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                  Bekijk {c.title} <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* All categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="mb-8 max-w-xl">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Alle categorieën
          </span>
          <h2 className="mt-3 font-display text-4xl text-forest-800 sm:text-5xl">
            Voor elk hoekje van het huis.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="border-y border-cream-200 bg-cream-100/60 py-16">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="mb-10 max-w-xl">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
              Even uitgelicht
            </span>
            <h2 className="mt-3 font-display text-4xl text-forest-800 sm:text-5xl">
              Onze persoonlijke selectie.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-warmbrown-600">
              Een kleine greep uit wat ons na aan het hart ligt.
            </p>
          </div>
          <ProductGrid products={products.filter((p) => p.featured).slice(0, 8)} cols={4} />
        </div>
      </section>
    </>
  );
}
