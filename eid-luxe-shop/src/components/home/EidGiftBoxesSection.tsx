"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import { Price } from "@/components/ui/Price";
import { ProductBadge } from "@/components/ui/Badge";
import type { Product } from "@/types";

export function EidGiftBoxesSection({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  const [hero, ...rest] = products.slice(0, 4);

  return (
    <section className="relative bg-olive-700 py-20 text-cream-50">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="gift-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <polygon points="24,4 44,24 24,44 4,24" fill="none" stroke="#f1e3b8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#gift-pat)" />
      </svg>

      <div className="relative mx-auto max-w-6xl px-4 lg:px-6">
        <div className="mb-12 max-w-2xl">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-cream-200/80">
            Eid pakketten
          </span>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            Klaar om te schenken,
            <span className="italic text-cream-200/85"> aan wie je liefhebt.</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream-200/80">
            Onze pakketten zijn samengesteld met de mensen in gedachten die ze
            ontvangen — een ouder, een vriend, een gezin in het buitenland.
            Elk pakje wordt rustig ingepakt en met een handgeschreven kaartje
            verstuurd.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Hero gift box */}
          <Link
            href={`/product/${hero.slug}`}
            className="group relative overflow-hidden rounded-2xl bg-cream-50 p-2 shadow-soft"
          >
            <div className="relative">
              <ProductImage
                slug={hero.slug}
                accent={hero.imageAccent}
                alt={hero.name}
                className="aspect-[4/3] rounded-xl"
              />
              <div className="absolute left-3 top-3">
                {hero.badge && <ProductBadge badge={hero.badge} />}
              </div>
            </div>
            <div className="flex items-end justify-between p-5">
              <div>
                <p className="font-display text-xl text-forest-800">{hero.name}</p>
                <p className="mt-1 text-sm text-warmbrown-500">{hero.description}</p>
              </div>
              <div className="text-right">
                <Price amount={hero.price} oldAmount={hero.oldPrice} size="md" />
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-warmbrown-500">
                  Bekijk <ArrowRight size={11} />
                </span>
              </div>
            </div>
          </Link>

          {/* Smaller gift boxes */}
          <div className="grid gap-5 sm:grid-cols-2">
            {rest.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-cream-50 p-2 shadow-soft transition-shadow hover:shadow-warm"
              >
                <div className="relative">
                  <ProductImage
                    slug={p.slug}
                    accent={p.imageAccent}
                    alt={p.name}
                    className="aspect-[4/3] rounded-xl"
                  />
                  <div className="absolute left-3 top-3">
                    {p.badge && <ProductBadge badge={p.badge} />}
                  </div>
                </div>
                <div className="flex flex-1 items-end justify-between p-4">
                  <p className="font-display text-base leading-tight text-forest-800">
                    {p.name}
                  </p>
                  <Price amount={p.price} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
