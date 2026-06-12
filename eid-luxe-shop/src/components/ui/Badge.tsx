import type { Badge as BadgeType } from "@/types";
import { cn } from "@/lib/utils";

const labels: Record<BadgeType, string> = {
  best_seller: "Familie favoriet",
  limited_eid: "Voor Eid",
  gift_ready: "Klaar om te schenken",
  new: "Nieuw",
  premium: "Met zorg gemaakt",
};

const styles: Record<BadgeType, string> = {
  best_seller: "bg-cream-200 text-forest-700",
  limited_eid: "bg-olive-600 text-cream-50",
  gift_ready: "bg-clay-100 text-warmbrown-600",
  new: "bg-cream-50 text-forest-700 border border-cream-300",
  premium: "bg-warmbrown-500 text-cream-50",
};

export function ProductBadge({
  badge,
  className,
}: {
  badge: BadgeType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
        styles[badge],
        className,
      )}
    >
      {labels[badge]}
    </span>
  );
}
