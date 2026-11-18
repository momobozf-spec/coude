import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { Footer, Header } from "@/components/SiteChrome";
import { ResultClient } from "@/components/ResultClient";

export const metadata: Metadata = { title: BRAND, robots: { index: false, follow: false } };

async function Gate({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[lang]/result">["searchParams"] }) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";
  return <ResultClient locale={locale} sessionId={sessionId} />;
}

export default async function ResultPage({ params, searchParams }: PageProps<"/[lang]/result">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      <Header locale={lang} />
      <main className="mx-auto min-h-[60vh] max-w-6xl px-4 pt-6 sm:px-6">
        <Suspense fallback={<p className="text-xl font-semibold">{getDict(lang).result.checking}</p>}>
          <Gate locale={lang} searchParams={searchParams} />
        </Suspense>
      </main>
      <Footer locale={lang} />
    </>
  );
}
