import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { FALLBACK_LOCALE, LOCALES, LOCALE_TAG, getDict, isLocale } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}


export const viewport: Viewport = { themeColor: "#f6f2ff", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = getDict(lang);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: d.meta.title,
    description: d.meta.description,
    alternates: {
      canonical: `/${lang}`,
      languages: { ...Object.fromEntries(LOCALES.map((l) => [LOCALE_TAG[l], `/${l}`])), "x-default": `/${FALLBACK_LOCALE}` },
    },
    openGraph: { title: d.meta.title, description: d.meta.description, type: "website", locale: LOCALE_TAG[lang].replace("-", "_") },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={LOCALE_TAG[lang]}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
