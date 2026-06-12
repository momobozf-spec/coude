import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(rating);
        return (
          <Star
            key={i}
            size={size}
            className={filled ? "fill-warmbrown-400 text-warmbrown-400" : "text-cream-300"}
            strokeWidth={1.4}
          />
        );
      })}
    </div>
  );
}
