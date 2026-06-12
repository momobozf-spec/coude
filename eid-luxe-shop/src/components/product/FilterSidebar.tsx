"use client";

import { categories } from "@/data/categories";
import type { Audience } from "@/types";
import { cn } from "@/lib/utils";

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "all", label: "Iedereen" },
  { id: "him", label: "Voor hem" },
  { id: "her", label: "Voor haar" },
  { id: "kids", label: "Voor de kleintjes" },
  { id: "family", label: "Voor het gezin" },
];

const PRICE_RANGES = [
  { id: "0-50", label: "Onder €50", min: 0, max: 50 },
  { id: "50-100", label: "€50 - €100", min: 50, max: 100 },
  { id: "100-150", label: "€100 - €150", min: 100, max: 150 },
  { id: "150-9999", label: "€150 +", min: 150, max: 9999 },
] as const;

export interface FilterValues {
  category: string | null;
  audience: Audience | null;
  priceRange: string | null;
  inStockOnly: boolean;
}

export function FilterSidebar({
  values,
  onChange,
  onReset,
  className,
}: {
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onReset: () => void;
  className?: string;
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border-b border-cream-200 py-5 last:border-0">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-warmbrown-500">
        {title}
      </h4>
      {children}
    </div>
  );

  const Pill = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-forest-600 bg-forest-600 text-cream-50"
          : "border-cream-300 bg-cream-50 text-forest-700 hover:border-forest-400",
      )}
    >
      {label}
    </button>
  );

  return (
    <aside className={cn("text-sm", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-forest-800">Filters</h3>
        <button
          onClick={onReset}
          className="text-[11px] uppercase tracking-[0.18em] text-warmbrown-500 hover:text-olive-600"
        >
          Reset
        </button>
      </div>

      <Section title="Categorie">
        <div className="grid gap-1">
          <button
            onClick={() => onChange({ ...values, category: null })}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
              values.category === null
                ? "bg-cream-100 text-forest-800 font-medium"
                : "text-forest-700 hover:bg-cream-100",
            )}
          >
            Alle categorieën
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                onChange({ ...values, category: values.category === c.id ? null : c.id })
              }
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                values.category === c.id
                  ? "bg-cream-100 text-forest-800 font-medium"
                  : "text-forest-700 hover:bg-cream-100",
              )}
            >
              <span className="mr-2">{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Voor wie">
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCES.map((a) => (
            <Pill
              key={a.id}
              active={values.audience === a.id || (a.id === "all" && values.audience === null)}
              label={a.label}
              onClick={() =>
                onChange({ ...values, audience: a.id === "all" ? null : a.id })
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Prijs">
        <div className="grid gap-1.5">
          {PRICE_RANGES.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-cream-100"
            >
              <input
                type="radio"
                name="price"
                checked={values.priceRange === r.id}
                onChange={() => onChange({ ...values, priceRange: r.id })}
                className="accent-forest-600"
              />
              <span className="text-forest-700">{r.label}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-cream-100">
            <input
              type="radio"
              name="price"
              checked={values.priceRange === null}
              onChange={() => onChange({ ...values, priceRange: null })}
              className="accent-forest-600"
            />
            <span className="text-forest-700">Alle prijzen</span>
          </label>
        </div>
      </Section>

      <Section title="Voorraad">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-forest-700">
          <input
            type="checkbox"
            checked={values.inStockOnly}
            onChange={(e) => onChange({ ...values, inStockOnly: e.target.checked })}
            className="accent-olive-600"
          />
          Enkel op voorraad
        </label>
      </Section>
    </aside>
  );
}

export const PRICE_RANGES_EXPORT = PRICE_RANGES;
