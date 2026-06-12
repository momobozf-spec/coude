import type { LucideIcon } from "lucide-react";

/**
 * TrustBadge — small reassurance item (icon + title + line) used in the
 * homepage trust strip, product detail and footer.
 */
export default function TrustBadge({
  icon: Icon,
  title,
  desc,
  align = "left",
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  align?: "left" | "center";
}) {
  if (align === "center") {
    return (
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/30 text-emerald">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/30 text-emerald">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}
