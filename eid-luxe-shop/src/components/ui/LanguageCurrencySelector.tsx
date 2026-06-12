"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { usePreferences } from "@/lib/store";
import type { Currency, Language } from "@/types";
import { cn } from "@/lib/utils";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "fr", label: "Français" },
];

const CURRENCIES: Currency[] = ["EUR", "USD", "GBP"];

export function LanguageCurrencySelector({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const { language, currency, setLanguage, setCurrency } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          variant === "light"
            ? "text-forest-700 hover:bg-cream-100"
            : "text-cream-100 hover:bg-forest-700",
        )}
      >
        <Globe size={14} />
        <span className="uppercase tracking-wider">{language}</span>
        <span className="opacity-60">/</span>
        <span>{currency}</span>
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-cream-200 bg-cream-50 p-3 shadow-luxe animate-fade-in">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-warmbrown-500">
            Language
          </p>
          <div className="mb-3 grid grid-cols-1 gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  language === l.code
                    ? "bg-forest-600 text-cream-50"
                    : "text-forest-700 hover:bg-cream-100",
                )}
              >
                <span>{l.label}</span>
                <span className="text-[10px] uppercase opacity-70">{l.code}</span>
              </button>
            ))}
          </div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-warmbrown-500">
            Currency
          </p>
          <div className="grid grid-cols-3 gap-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium transition-colors",
                  currency === c
                    ? "bg-forest-600 text-cream-50"
                    : "text-forest-700 hover:bg-cream-100",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
