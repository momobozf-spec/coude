import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { Footer, Header } from "@/components/SiteChrome";
import { StartClient } from "@/components/StartClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/start">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: `${getDict(lang).upload.title} | ${BRAND}`, alternates: { canonical: `/${lang}/start` } };
}

async function Gate({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[lang]/start">["searchParams"] }) {
  const sp = await searchParams;
  return <StartClient locale={locale} canceled={sp.canceled === "1"} />;
}

export default async function StartPage({ params, searchParams }: PageProps<"/[lang]/start">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      <Header locale={lang} path="/start" />
      <main className="mx-auto min-h-[60vh] max-w-6xl px-4 pt-6 sm:px-6">
        <Suspense fallback={null}>
          <Gate locale={lang} searchParams={searchParams} />
        </Suspense>
      </main>
      <Footer locale={lang} />
    </>
  );
}
