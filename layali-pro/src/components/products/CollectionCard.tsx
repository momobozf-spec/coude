import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import { cn } from "@/lib/utils";

/**
 * CollectionCard — storytelling tile linking to a filtered shop view.
 * Background is an AtmosphereTile (no label of its own) with a dark gradient
 * and an overlaid title / description / CTA.
 */
export default function CollectionCard({
  title,
  desc,
  href,
  seed,
  category,
  cta,
  className,
  aspect = "aspect-[3/4]",
}: {
  title: string;
  desc?: string;
  href: string;
  seed: string;
  category?: string;
  cta?: string;
  className?: string;
  aspect?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group relative block overflow-hidden rounded-2xl shadow-soft", aspect, className)}
    >
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
        <AtmosphereTile seed={seed} label="" category={category} showLabel={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">{title}</h3>
        {desc && <p className="mt-1 text-xs text-white/80">{desc}</p>}
        {cta && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-white">
            {cta}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        )}
      </div>
    </Link>
  );
}
