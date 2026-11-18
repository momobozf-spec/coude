import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dictionaries";
import { LegalPage } from "@/components/LegalPage";
import { company, privacy } from "@/legal/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: `${getDict(lang).legal.privacyTitle} | ${BRAND}`, alternates: { canonical: `/${lang}/privacy` } };
}

export default async function Page({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage locale={lang} path="/privacy" title={getDict(lang).legal.privacyTitle} sections={privacy(lang, company())} />;
}
