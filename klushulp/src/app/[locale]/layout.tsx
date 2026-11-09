import type { Metadata } from "next";
import { headers } from "next/headers";
import "../globals.css";
import { LOCALES } from "@/i18n/config";
import { localeFromParams } from "@/lib/locale";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Klushulp", template: "%s · Klushulp" },
  description: "Loodgieters, elektriciens en klushulp in je buurt. Plaats je klus in één minuut, vergelijk voorstellen en boek.",
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await localeFromParams(params);
  const h = await headers();
  const currentPath = h.get("x-pathname") ?? `/${locale}`;
  return (
    <html lang={locale}>
      <body className="min-h-dvh flex flex-col">
        <SiteHeader locale={locale} currentPath={currentPath} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
