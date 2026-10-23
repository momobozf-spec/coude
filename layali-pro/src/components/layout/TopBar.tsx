"use client";

import { useTranslations } from "next-intl";
import { Truck, ShieldCheck, PackageCheck } from "lucide-react";

/**
 * TopBar — slim announcement bar above the header. On wide screens it shows
 * three static reassurance messages; on small screens the same messages scroll
 * in a seamless marquee so nothing is truncated.
 */
export default function TopBar() {
  const t = useTranslations("topbar");

  const messages = [
    { icon: Truck, text: t("shipping") },
    { icon: ShieldCheck, text: t("payment") },
    { icon: PackageCheck, text: t("delivery") },
  ];

  return (
    <div className="bg-secondary text-secondary-foreground text-[11px] sm:text-xs tracking-wide">
      {/* Desktop: evenly spaced */}
      <div className="mx-auto hidden max-w-7xl items-center justify-center gap-10 px-4 py-2 sm:flex">
        {messages.map((m) => (
          <span key={m.text} className="flex items-center gap-2">
            <m.icon className="h-3.5 w-3.5 text-gold-light" strokeWidth={2} />
            {m.text}
          </span>
        ))}
      </div>

      {/* Mobile: seamless marquee (content duplicated for the loop) */}
      <div className="relative flex overflow-hidden py-2 sm:hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...messages, ...messages].map((m, i) => (
            <span key={i} className="mx-6 flex items-center gap-2">
              <m.icon className="h-3.5 w-3.5 text-gold-light" strokeWidth={2} />
              {m.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
