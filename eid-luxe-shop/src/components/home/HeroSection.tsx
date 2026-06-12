"use client";

import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export function HeroSection() {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-cream-100">
      {/* Soft Arabic geometric pattern, very subtle */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-pattern" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M24 4 L44 24 L24 44 L4 24 Z M24 12 L36 24 L24 36 L12 24 Z"
              fill="none"
              stroke="#3a4527"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#hero-pattern)" />
      </svg>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-6 lg:py-24">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            {t("hero.eyebrow")}
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] text-forest-800 sm:text-6xl">
            {t("hero.title")}
            <br />
            <span className="italic text-warmbrown-600">met wie je liefhebt.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-warmbrown-600">
            {t("hero.subtitle")}
          </p>
          <p className="mt-3 max-w-lg text-sm italic text-warmbrown-500">
            Een kleine familiezaak — opgericht door twee gezinshoofden, met
            respect voor onze tradities.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/shop" variant="primary" size="md">
              {t("hero.cta_primary")}
              <ArrowRight size={14} />
            </LinkButton>
            <LinkButton href="/gift-boxes" variant="ghost" size="md">
              {t("hero.cta_secondary")}
            </LinkButton>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-6 text-xs text-warmbrown-500">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-warmbrown-400" />
              <span>Verzonden uit Antwerpen</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-warmbrown-400" />
              <span>Halal en met zorg gekozen</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-warmbrown-400" />
              <span>Met liefde verpakt</span>
            </div>
          </div>
        </div>

        {/* Hero visual — sober, minder commercieel */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-olive-500 to-olive-700 p-7 shadow-soft">
              <div className="flex h-full flex-col justify-between text-cream-50/95">
                <span className="text-[10px] uppercase tracking-[0.22em] text-cream-200/80">
                  Eid pakket
                </span>
                <div>
                  {/* Simple olive branch motif */}
                  <svg viewBox="0 0 100 100" className="mb-3 h-14 w-14 opacity-90">
                    <g fill="none" stroke="#f1e3b8" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M20 80 Q50 50 80 20" />
                      <ellipse cx="35" cy="60" rx="6" ry="3" transform="rotate(-45 35 60)" fill="#f1e3b8" fillOpacity="0.4" />
                      <ellipse cx="50" cy="45" rx="6" ry="3" transform="rotate(-45 50 45)" fill="#f1e3b8" fillOpacity="0.4" />
                      <ellipse cx="65" cy="30" rx="6" ry="3" transform="rotate(-45 65 30)" fill="#f1e3b8" fillOpacity="0.4" />
                    </g>
                  </svg>
                  <p className="font-display text-xl leading-tight">
                    Familiepakket Eid
                  </p>
                  <p className="mt-1.5 text-xs text-cream-200/80">
                    Dadels, kaars, gebedssnoer en thee — met handgeschreven
                    kaartje.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="aspect-square rounded-2xl bg-cream-200 p-5 shadow-soft">
                <div className="flex h-full flex-col justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-warmbrown-500">
                    Ajwa dadels
                  </span>
                  <div>
                    <svg viewBox="0 0 60 60" className="mb-2 h-9 w-9 text-warmbrown-500">
                      <g fill="none" stroke="currentColor" strokeWidth="1.5">
                        <ellipse cx="30" cy="30" rx="14" ry="20" />
                        <ellipse cx="30" cy="30" rx="6" ry="14" fill="currentColor" fillOpacity="0.2" />
                      </g>
                    </svg>
                    <p className="font-display text-base leading-tight text-forest-800">
                      Uit Madinah
                    </p>
                    <p className="mt-0.5 text-[11px] text-warmbrown-500">Vanaf €39</p>
                  </div>
                </div>
              </div>
              <div className="aspect-square rounded-2xl bg-cream-50 p-5 shadow-soft">
                <div className="flex h-full flex-col justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-warmbrown-500">
                    Voor het gebed
                  </span>
                  <div>
                    <svg viewBox="0 0 60 60" className="mb-2 h-9 w-9 text-olive-500">
                      <g fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M15 50 L15 25 Q15 15 30 15 Q45 15 45 25 L45 50 Z" />
                        <path d="M22 50 L22 30 Q22 25 30 25 Q38 25 38 30 L38 50" />
                      </g>
                    </svg>
                    <p className="font-display text-base leading-tight text-forest-800">
                      Gebedsmat set
                    </p>
                    <p className="mt-0.5 text-[11px] text-warmbrown-500">Vanaf €55</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
