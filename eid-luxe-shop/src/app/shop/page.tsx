"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { products } from "@/data/products";
import { categories, findCategory } from "@/data/categories";
import { FilterSidebar, type FilterValues, PRICE_RANGES_EXPORT } from "@/components/product/FilterSidebar";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { Audience } from "@/types";

type Sort = "popular" | "new" | "price-asc" | "price-desc" | "best-sellers";

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCategory = searchParams.get("category");
  const initialAudience = searchParams.get("audience") as Audience | null;
  const initialSort = (searchParams.get("sort") || "popular") as Sort;
  const initialQ = searchParams.get("q") || "";

  const [filters, setFilters] = useState<FilterValues>({
    category: initialCategory,
    audience: initialAudience,
    priceRange: null,
    inStockOnly: false,
  });
  const [sort, setSort] = useState<Sort>(initialSort);
  const [search, setSearch] = useState(initialQ);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...products];
    if (filters.category) list = list.filter((p) => p.category === filters.category);
    if (filters.audience)
      list = list.filter(
        (p) => p.targetAudience === filters.audience || p.targetAudience === "all",
      );
    if (filters.priceRange) {
      const range = PRICE_RANGES_EXPORT.find((r) => r.id === filters.priceRange);
      if (range) list = list.filter((p) => p.price >= range.min && p.price < range.max);
    }
    if (filters.inStockOnly) list = list.filter((p) => p.stockStatus !== "out_of_stock");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "new") list.sort((a, b) => (b.badge === "new" ? 1 : 0) - (a.badge === "new" ? 1 : 0));
    else if (sort === "best-sellers")
      list.sort(
        (a, b) =>
          (b.badge === "best_seller" ? 1 : 0) - (a.badge === "best_seller" ? 1 : 0) ||
          b.reviewCount - a.reviewCount,
      );
    else list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [filters, search, sort]);

  const cat = filters.category ? findCategory(filters.category) : null;

  const reset = () => {
    setFilters({ category: null, audience: null, priceRange: null, inStockOnly: false });
    setSort("popular");
    setSearch("");
    router.replace("/shop");
  };

  return (
    <>
      {/* Page header */}
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            {cat ? "Categorie" : "De hele shop"}
          </p>
          <h1 className="mt-3 font-display text-4xl text-forest-800 sm:text-5xl">
            {cat ? cat.name : "Onze hele collectie."}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-warmbrown-600">
            {cat
              ? cat.description
              : "Eid pakketten, decoratie voor het huis, parfum, gebedsspullen en kleine attenties — rustig samengesteld voor families."}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {categories.slice(0, 8).map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setFilters((f) => ({ ...f, category: f.category === c.id ? null : c.id }))
                }
                className={
                  filters.category === c.id
                    ? "rounded-full bg-forest-700 px-4 py-1.5 text-xs font-medium text-cream-50"
                    : "rounded-full border border-cream-300 bg-cream-50 px-4 py-1.5 text-xs font-medium text-forest-700 hover:border-forest-400"
                }
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <FilterSidebar values={filters} onChange={setFilters} onReset={reset} />
          </div>

          {/* Main */}
          <div>
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm text-warmbrown-500">
                <span className="font-medium text-forest-800">{filtered.length}</span>
                {filtered.length === 1 ? "product" : "producten"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-xs font-medium text-forest-700 hover:border-forest-400 lg:hidden"
                >
                  <SlidersHorizontal size={14} />
                  Filters
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Zoek..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="hidden rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-xs text-forest-700 placeholder:text-warmbrown-400 focus:border-olive-400 focus:outline-none sm:block"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-xs font-medium text-forest-700 focus:border-olive-400 focus:outline-none"
                >
                  <option value="popular">Sortering: rustig populair</option>
                  <option value="best-sellers">Familie favorieten</option>
                  <option value="new">Net toegevoegd</option>
                  <option value="price-asc">Prijs: laag naar hoog</option>
                  <option value="price-desc">Prijs: hoog naar laag</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-cream-200 bg-cream-50 px-6 py-16 text-center">
                <p className="font-display text-2xl text-forest-800">
                  Niets gevonden met deze filters.
                </p>
                <p className="mt-2 text-sm text-warmbrown-500">
                  Probeer een filter weg te halen, of bekijk gewoon de hele
                  collectie.
                </p>
                <button
                  onClick={reset}
                  className="mt-5 rounded-full bg-olive-600 px-6 py-2.5 text-sm font-medium text-cream-50 hover:bg-olive-700"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <ProductGrid products={filtered} cols={3} />
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-forest-800/60 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-cream-50 p-6 shadow-warm animate-slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl text-forest-800">Filters</h3>
              <button onClick={() => setDrawerOpen(false)} aria-label="Sluiten">
                <X size={22} className="text-forest-700" />
              </button>
            </div>
            <FilterSidebar values={filters} onChange={setFilters} onReset={reset} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-6 w-full rounded-full bg-olive-600 py-3 text-sm font-medium text-cream-50"
            >
              Toon {filtered.length} producten
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="px-6 py-20 text-center text-warmbrown-500">Loading…</div>}>
      <ShopContent />
    </Suspense>
  );
}
