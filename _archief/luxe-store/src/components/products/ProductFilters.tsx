"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductFiltersProps {
  categories: Category[];
  currentCategory?: string;
  currentSort?: string;
}

export default function ProductFilters({
  categories,
  currentCategory,
  currentSort,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/products?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          <button
            onClick={() => updateParam("category", "")}
            className={`block text-sm w-full text-left py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
              !currentCategory
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateParam("category", cat.slug)}
              className={`block text-sm w-full text-left py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                currentCategory === cat.slug
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Sort By</h3>
        <select
          value={currentSort || "newest"}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
