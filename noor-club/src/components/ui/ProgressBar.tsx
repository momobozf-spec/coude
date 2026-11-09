import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  label,
  className,
  tone = "gold",
}: {
  /** 0 - 1 */
  value: number;
  label: string;
  className?: string;
  tone?: "gold" | "emerald";
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
      className={cn("h-3 w-full overflow-hidden rounded-full bg-emerald-light", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "gold" ? "bg-gold" : "bg-emerald",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
