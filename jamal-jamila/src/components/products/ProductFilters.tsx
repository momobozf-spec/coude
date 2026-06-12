"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductFiltersProps {
  categories: { id: string; name: string; slug: string }[];
  currentCategory?: string;
  currentSort?: string;
}

const PRICE_RANGES = [
  { label: "< €25", min: "", max: "25" },
  { label: "€25 – €50", min: "25", max: "50" },
  { label: "€50 – €100", min: "50", max: "100" },
  { label: "€100+", min: "100", max: "" },
];

export default function ProductFilters({ categories, currentCategory, currentSort }: ProductFiltersProps) {
  const t = useTranslations("products");
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (entries: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const activeMin = searchParams.get("minPrice") || "";
  const activeMax = searchParams.get("maxPrice") || "";
  const saleOn = searchParams.get("sale") === "true";
  const bestOn = searchParams.get("bestseller") === "true";

  return (
    <div className="space-y-8 lg:sticky lg:top-28">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
        <SlidersHorizontal className="h-4 w-4" />
        {t("filters")}
      </div>

      {/* Quick toggles */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => updateParam({ bestseller: bestOn ? "" : "true" })}
          className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer", bestOn ? "border-emerald bg-emerald text-white" : "border-border hover:border-emerald")}
        >
          <Sparkles className="h-3.5 w-3.5" />{t("filterBestseller")}
        </button>
        <button
          onClick={() => updateParam({ sale: saleOn ? "" : "true" })}
          className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer", saleOn ? "border-burgundy bg-burgundy text-white" : "border-border hover:border-burgundy")}
        >
          <Tag className="h-3.5 w-3.5" />{t("filterSale")}
        </button>
      </div>

      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t("categoriesLabel")}</h3>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          <button onClick={() => updateParam({ category: "" })} className={cn("shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors cursor-pointer", !currentCategory ? "bg-emerald text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {t("allCategories")}
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => updateParam({ category: cat.slug })} className={cn("shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors cursor-pointer", currentCategory === cat.slug ? "bg-emerald text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t("priceLabel")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_RANGES.map((r) => {
            const active = activeMin === r.min && activeMax === r.max && (r.min !== "" || r.max !== "");
            return (
              <button
                key={r.label}
                onClick={() => updateParam({ minPrice: active ? "" : r.min, maxPrice: active ? "" : r.max })}
                className={cn("rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer", active ? "border-emerald bg-emerald/10 text-emerald" : "border-border hover:border-emerald")}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t("sortBy")}</h3>
        <select value={currentSort || "newest"} onChange={(e) => updateParam({ sort: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="newest">{t("newest")}</option>
          <option value="price_asc">{t("priceAsc")}</option>
          <option value="price_desc">{t("priceDesc")}</option>
        </select>
      </div>
    </div>
  );
}
