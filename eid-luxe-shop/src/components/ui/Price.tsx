"use client";

import { usePreferences } from "@/lib/store";
import { formatPrice } from "@/lib/currency";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/utils";

export function Price({
  amount,
  oldAmount,
  size = "md",
  className,
}: {
  amount: number;
  oldAmount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const mounted = useMounted();
  const currencyRaw = usePreferences((s) => s.currency);
  const currency = mounted ? currencyRaw : "EUR";
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  }[size];
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("font-medium text-forest-800", sizeClass)}>
        {formatPrice(amount, currency)}
      </span>
      {oldAmount ? (
        <span className="text-xs text-warmbrown-500 line-through">
          {formatPrice(oldAmount, currency)}
        </span>
      ) : null}
    </span>
  );
}
