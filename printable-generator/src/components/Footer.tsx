"use client";

import Link from "next/link";
import { getFeatures, type FeatureName } from "@/lib/features";
import { LEGAL } from "@/lib/legal-entity";
import { useI18n } from "@/i18n/context";
import { openCookieSettings } from "@/components/CookieConsent";

const FOOTER_LINKS: { label: string; href: string; feature?: FeatureName }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Games", href: "/games", feature: "games" },
  { label: "Academy", href: "/academy", feature: "academy" },
  { label: "Marketplace", href: "/marketplace", feature: "marketplace" },
  { label: "Books", href: "/books", feature: "books" },
  { label: "Blog", href: "/blog" },
  { label: "Prayer", href: "/prayer" },
  { label: "Pricing", href: "/#pricing" },
];

export function Footer() {
  const { t } = useI18n();
  const enabled = getFeatures();
  const links = FOOTER_LINKS.filter((l) => !l.feature || enabled[l.feature]);

  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🌙</span>
              <span className="font-bold" style={{ color: "#0d9488" }}>Noor Printables</span>
            </div>
            <p className="text-xs text-gray-400 max-w-xs">
              Islamic educational activities for kids aged 4-8: coloring pages, mazes and word searches.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} {LEGAL.name} &middot; {LEGAL.companyNumber} &middot; {LEGAL.city}
          </p>
          <nav className="flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600">{t("legal.privacy")}</Link>
            <Link href="/terms" className="hover:text-gray-600">{t("legal.terms")}</Link>
            <Link href="/cookies" className="hover:text-gray-600">{t("legal.cookies")}</Link>
            <Link href="/legal" className="hover:text-gray-600">{t("legal.imprint")}</Link>
            <button type="button" onClick={openCookieSettings} className="hover:text-gray-600">
              {t("cookie.settings")}
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
