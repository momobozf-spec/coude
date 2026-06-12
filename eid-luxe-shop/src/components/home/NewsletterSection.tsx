"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";

export function NewsletterSection() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="relative overflow-hidden border-y border-cream-200 bg-cream-100/70 py-20">
      {/* Subtle pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="news-pat" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M18 2 L34 18 L18 34 L2 18 Z" fill="none" stroke="#3a4527" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#news-pat)" />
      </svg>

      <div className="relative mx-auto max-w-2xl px-4 text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
          Onze brief
        </span>
        <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
          {t("newsletter.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-warmbrown-600">
          {t("newsletter.subtitle")}
        </p>

        {!done ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setDone(true);
            }}
            className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 rounded-full border border-cream-300 bg-cream-50 px-5 py-3 text-sm text-forest-800 placeholder:text-warmbrown-400 focus:border-olive-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-olive-600 px-6 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-olive-700"
            >
              {t("newsletter.button")}
            </button>
          </form>
        ) : (
          <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-olive-600 px-5 py-3 text-sm font-medium text-cream-50">
            <Check size={16} />
            Welkom in de familie · barakallahu fik
          </div>
        )}
        <p className="mt-4 text-[11px] tracking-wide text-warmbrown-500">
          Door je in te schrijven ga je akkoord met onze nieuwsbrief. Je kan
          steeds uitschrijven met één klik.
        </p>
      </div>
    </section>
  );
}
