import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dictionaries";
import { LegalPage } from "@/components/LegalPage";
import { company, imprint } from "@/legal/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/imprint">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: `${getDict(lang).legal.imprintTitle} | ${BRAND}`, alternates: { canonical: `/${lang}/imprint` } };
}

export default async function Page({ params }: PageProps<"/[lang]/imprint">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage locale={lang} path="/imprint" title={getDict(lang).legal.imprintTitle} sections={imprint(lang, company())} />;
}
