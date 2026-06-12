"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { categories } from "@/data/categories";
import { LanguageCurrencySelector } from "@/components/ui/LanguageCurrencySelector";

const PRIMARY = [
  { href: "/shop", label: "Hele shop" },
  { href: "/gift-boxes", label: "Eid pakketten" },
  { href: "/collections", label: "Collecties" },
  { href: "/about", label: "Ons verhaal" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "Veelgestelde vragen" },
];

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-forest-800/60 animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-cream-50 shadow-luxe animate-slide-in-right overflow-y-auto">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-5">
          <span className="font-display text-xl text-forest-800">
            Bayt <span className="text-warmbrown-500">Noor</span>
          </span>
          <button onClick={onClose} aria-label="Close" className="text-forest-700">
            <X size={22} />
          </button>
        </div>
        <nav className="px-5 py-4">
          <ul className="grid gap-1">
            {PRIMARY.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-forest-800 hover:bg-cream-100"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-warmbrown-500">
            Categorieën
          </p>
          <ul className="grid gap-0.5">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/shop?category=${c.id}`}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2 text-sm text-forest-700 hover:bg-cream-100"
                >
                  {c.icon} {c.name}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-cream-200 pt-5">
            <LanguageCurrencySelector />
          </div>
        </nav>
      </div>
    </div>
  );
}
