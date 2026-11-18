import { Footer, Header } from "./SiteChrome";
import { getDict, type Locale } from "@/i18n/dictionaries";
import { LEGAL_UPDATED, type LegalSection } from "@/legal/content";

export function LegalPage({ locale, path, title, sections }: { locale: Locale; path: string; title: string; sections: LegalSection[] }) {
  const d = getDict(locale);
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-BE`, { dateStyle: "long" }).format(new Date(LEGAL_UPDATED));
  return (
    <>
      <Header locale={locale} path={path} />
      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <h1 className="display text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {d.legal.lastUpdated}: {date}
        </p>
        {sections.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-2xl font-bold">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p} className="mt-3 text-ink-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
      <Footer locale={locale} />
    </>
  );
}
