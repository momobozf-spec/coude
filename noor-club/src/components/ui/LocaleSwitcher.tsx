"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/navigation";
import { LOCALES, LOCALE_LABELS, isLocale } from "@/lib/locales";

/**
 * Switches language while staying on the exact same page.
 *
 * `usePathname` from next-intl returns the route *without* the locale segment
 * (e.g. `/pakket/2026-09-wudu`), so replacing it with a different `locale`
 * lands on the translated twin of the current page rather than the home page.
 */
export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next)) return;
          startTransition(() => {
            router.replace(href, { locale: next });
          });
        }}
        className="min-h-[40px] rounded-full border-2 border-emerald-light bg-white px-3 text-sm font-bold text-emerald-dark"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
