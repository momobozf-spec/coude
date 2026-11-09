"use client";

import { useTranslations } from "next-intl";
import { Truck, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";

/**
 * FreeShippingBar — progress bar towards the free-shipping threshold.
 * Reused in the cart drawer and checkout summary. When the threshold is met it
 * switches to a success state.
 */
export default function FreeShippingBar({
  subtotal,
  threshold = 75,
  className = "",
}: {
  subtotal: number;
  threshold?: number;
  className?: string;
}) {
  const t = useTranslations("cart");
  const remaining = Math.max(0, threshold - subtotal);
  const reached = remaining <= 0;
  const pct = Math.min(100, (subtotal / threshold) * 100);

  return (
    <div className={className}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-secondary">
        {reached ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald" />
            {t("freeShippingReached")}
          </>
        ) : (
          <>
            <Truck className="h-3.5 w-3.5 text-caramel" />
            {t("freeShippingMessage", { amount: formatPrice(remaining) })}
          </>
        )}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-caramel to-emerald transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
