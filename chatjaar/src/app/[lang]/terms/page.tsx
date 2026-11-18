import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dictionaries";
import { LegalPage } from "@/components/LegalPage";
import { company, terms } from "@/legal/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: `${getDict(lang).legal.termsTitle} | ${BRAND}`, alternates: { canonical: `/${lang}/terms` } };
}

export default async function Page({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage locale={lang} path="/terms" title={getDict(lang).legal.termsTitle} sections={terms(lang, company())} />;
}
