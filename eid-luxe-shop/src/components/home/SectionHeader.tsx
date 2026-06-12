import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  link,
  linkLabel = "View all",
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  link?: string;
  linkLabel?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mb-10 text-center"
          : "mb-10 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between"
      }
    >
      <div className={align === "center" ? "" : "max-w-xl"}>
        {eyebrow && (
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            {eyebrow}
          </span>
        )}
        <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-3 max-w-xl text-sm leading-relaxed text-warmbrown-500 sm:text-base ${align === "center" ? "mx-auto" : ""}`}>
            {subtitle}
          </p>
        )}
      </div>
      {link && (
        <Link
          href={link}
          className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-warmbrown-600 hover:text-olive-600 transition-colors"
        >
          {linkLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
