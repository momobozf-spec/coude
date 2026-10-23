import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SectionHeader — consistent heading block for homepage / listing sections.
 * `align="center"` for hero-style centered intros, `align="between"` for a
 * left title with an optional "view all" link on the right.
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  viewAllHref,
  viewAllLabel,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "between";
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}) {
  const heading = (
    <div className={cn(align === "center" && "text-center")}>
      {eyebrow && (
        <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-caramel mb-3">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground max-w-xl leading-relaxed">{subtitle}</p>}
      {align === "center" && <div className="rule-gold w-24 mx-auto mt-5" />}
    </div>
  );

  if (align === "between") {
    return (
      <div className={cn("flex items-end justify-between gap-4 mb-10", className)}>
        {heading}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-secondary whitespace-nowrap hover:text-emerald transition-colors"
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    );
  }

  return <div className={cn("mb-12", className)}>{heading}</div>;
}
