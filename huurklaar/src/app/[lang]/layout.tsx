import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/account";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { Header } from "@/components/Header";
import "@fontsource-variable/mona-sans/wght.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "../globals.css";


export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: t.meta.title,
    description: t.meta.desc,
    alternates: { languages: { "nl-BE": "/nl", "fr-BE": "/fr" } },
    openGraph: { title: t.meta.title, description: t.meta.desc, locale: lang === "fr" ? "fr_BE" : "nl_BE", type: "website" },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const account = await getAccount().catch(() => null);

  return (
    <html lang={lang === "fr" ? "fr-BE" : "nl-BE"}>
      <body>
        <a className="skip" href="#main">{lang === "fr" ? "Aller au contenu" : "Naar de inhoud"}</a>
        <Header lang={lang} t={t} loggedIn={!!account} />
        <main id="main" className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>{t.f.company}</span>
            <span>
              <a href={`/${lang}/privacy`}>{t.f.privacy}</a> · <a href={`/${lang}/voorwaarden`}>{t.f.terms}</a> · {t.f.noLegal}
            </span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
