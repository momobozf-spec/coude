import Link from "next/link";
import type { Category } from "@/types";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CategoryCard({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <Link
      href={`/shop?category=${category.id}`}
      className={cn(
        "group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-soft transition-shadow duration-300 hover:shadow-warm sm:p-6",
        category.accent,
        className,
      )}
    >
      {/* pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.05]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
      >
        <defs>
          <pattern id={`cat-${category.id}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="0.6" fill="#3a4527" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#cat-${category.id})`} />
      </svg>

      <span className="relative text-2xl opacity-80">{category.icon}</span>
      <div className="relative">
        <p className="font-display text-xl leading-tight text-forest-800">{category.name}</p>
        <p className="mt-1 text-xs text-warmbrown-600 line-clamp-2">{category.description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-warmbrown-600 transition-transform group-hover:translate-x-0.5">
          Bekijk <ArrowUpRight size={12} />
        </span>
      </div>
    </Link>
  );
}
