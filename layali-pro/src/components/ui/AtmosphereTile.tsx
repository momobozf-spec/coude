import {
  Coffee,
  Flame,
  Droplets,
  Gift,
  Sparkles,
  Home,
  Moon,
  Leaf,
  Utensils,
  Sofa,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AtmosphereTile — CSS-only "product photography".
 *
 * The shop ships without real photos: instead of broken/placeholder images we
 * render a warm oriental gradient (one of 8 tones, chosen deterministically per
 * `seed`), a faint geometric lattice, a soft category glyph and a serif label.
 * Used anywhere a product/collection image would appear. No external requests.
 *
 * Rendered as a plain (server-compatible) component so it can be used in both
 * server and client trees.
 */

const CATEGORY_ICON: Record<string, LucideIcon> = {
  "home-decor": Home,
  "tea-experience": Coffee,
  tableware: Utensils,
  fragrance: Sparkles,
  "candles-lanterns": Flame,
  "hammam-wellness": Droplets,
  gifts: Gift,
  "wedding-henna": Heart,
  "kitchen-serving": Utensils,
  "cushions-textiles": Sofa,
  seasonal: Moon,
};

/** Stable string hash → small non-negative int. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export default function AtmosphereTile({
  seed,
  label,
  category,
  className,
  glyphClassName,
  showLabel = true,
}: {
  seed: string;
  label: string;
  category?: string;
  className?: string;
  glyphClassName?: string;
  showLabel?: boolean;
}) {
  const tone = hash(seed) % 8;
  const Icon = (category && CATEGORY_ICON[category]) || Leaf;

  return (
    <div className={cn("relative h-full w-full overflow-hidden atmo-" + tone, className)}>
      {/* Geometric lattice */}
      <div className="absolute inset-0 pattern-zellige opacity-70" />
      {/* Soft radial light from top-left */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_10%,rgba(255,255,255,0.28),transparent_55%)]" />
      {/* Bottom shade for label legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />

      {/* Large faint category glyph */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon
          className={cn("h-1/3 w-1/3 text-white/35", glyphClassName)}
          strokeWidth={1}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div className="absolute inset-x-0 bottom-0 p-4 text-center">
          <span
            className="font-[family-name:var(--font-serif)] text-white/95 text-base sm:text-lg leading-tight drop-shadow-sm line-clamp-2"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.25)" }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
