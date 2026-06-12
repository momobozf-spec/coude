import type { Product } from "@/types";
import { ProductCard } from "@/components/product/ProductCard";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  className,
  cols = 4,
}: {
  products: Product[];
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  const colClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }[cols];
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6", colClass, className)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
