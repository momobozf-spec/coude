import { Hand, Heart, Home } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LinkButton } from "@/components/ui/Button";
import { TrustBadges } from "@/components/product/TrustBadges";
import { giftBoxes, products } from "@/data/products";

export default function GiftBoxesPage() {
  const boxes = giftBoxes();
  const familyBoxes = products.filter((p) => p.category === "family-gifts");

  return (
    <>
      {/* Sober warm hero */}
      <section className="relative overflow-hidden bg-olive-700 text-cream-50">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="gb-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M24 4 L44 24 L24 44 L4 24 Z" fill="none" stroke="#f1e3b8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#gb-pat)" />
        </svg>

        <div className="relative mx-auto max-w-5xl px-4 py-20 lg:px-6 lg:py-28">
          <div className="max-w-2xl">
            <span className="text-[11px] uppercase tracking-[0.22em] text-cream-200/80">
              Eid pakketten
            </span>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] sm:text-6xl">
              Klaar om te schenken,
              <br />
              <span className="italic text-cream-200/85">aan wie je liefhebt.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-cream-200/85">
              Elke box is door ons of door familie ingepakt, met een kaartje
              erbij dat we zelf schrijven. We versturen nooit naamloos &mdash; de
              naam van degene voor wie je het bestelt staat altijd op het
              kaartje.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="#all" variant="secondary" size="md">
                Bekijk de pakketten
              </LinkButton>
              <LinkButton
                href="/contact"
                variant="ghost"
                size="md"
                className="!text-cream-50 hover:!bg-cream-50/10"
              >
                Een vraag? Schrijf ons
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-cream-200 bg-cream-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 lg:px-6">
          <Value
            icon={<Hand size={18} strokeWidth={1.6} />}
            title="Met onze handen ingepakt"
            desc="Elk pakket wordt rustig samengesteld in onze studio in Antwerpen, met een handgeschreven kaartje."
          />
          <Value
            icon={<Heart size={18} strokeWidth={1.6} />}
            title="Met intentie samengebracht"
            desc="We kiezen niet wat goed verkoopt, maar wat goed is. Halal, eerlijk, gezond verstand."
          />
          <Value
            icon={<Home size={18} strokeWidth={1.6} />}
            title="Naar familie wereldwijd"
            desc="Stuur direct naar wie je liefhebt &mdash; in een ander land, of net om de hoek. Geen prijzen op het pakket."
          />
        </div>
      </section>

      {/* All boxes */}
      <section id="all" className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
        <div className="mb-10 max-w-xl">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Onze collectie
          </span>
          <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
            Alle Eid pakketten.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-warmbrown-600">
            Van een kleine attentie tot een groot familiepakket &mdash; voor
            iedereen die belangrijk voor je is.
          </p>
        </div>
        <ProductGrid products={boxes} cols={3} />
      </section>

      {/* Family bundles */}
      {familyBoxes.length > 0 && (
        <section className="border-y border-cream-200 bg-cream-100/60 py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-6">
            <div className="mb-10 max-w-xl">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
                Voor de hele familie
              </span>
              <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
                Familiepakketten,
                <span className="italic text-warmbrown-600"> ruim genoeg om te delen.</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-warmbrown-600">
                Voor wie thuis viert met meerdere generaties &mdash; ouders,
                kinderen, kleinkinderen rond dezelfde tafel.
              </p>
            </div>
            <ProductGrid products={familyBoxes} cols={3} />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <TrustBadges />
      </section>
    </>
  );
}

function Value({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-cream-200 text-olive-600">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-base leading-tight text-forest-800">{title}</h3>
        <p className="mt-1 text-sm text-warmbrown-600">{desc}</p>
      </div>
    </div>
  );
}
