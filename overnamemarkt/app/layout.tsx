import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getViewer } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: "Online bedrijven kopen en verkopen in België en Nederland: SaaS, websites, apps, webshops en online diensten.",
  openGraph: { siteName: site.name, locale: "nl_BE", type: "website" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  let isAdmin = false;
  try {
    const viewer = await getViewer();
    user = viewer.user;
    isAdmin = viewer.isAdmin;
  } catch {
    // Zonder Supabase-configuratie toont de site de publieke navigatie.
  }

  return (
    <html lang="nl">
      <body>
        <header className="bar">
          <div className="wrap">
            <Link className="brand" href="/">{site.name}</Link>
            <nav className="nav" aria-label="Hoofdmenu">
              <Link href="/">Aanbod</Link>
              <Link href="/verkopen">Verkopen</Link>
              <Link href="/hoe-het-werkt">Hoe het werkt</Link>
              {user ? <Link href="/account">Mijn account</Link> : <Link href="/login">Aanmelden</Link>}
              {isAdmin && <Link href="/beheer">Beheer</Link>}
              {user && (
                <form action="/auth/signout" method="post">
                  <button type="submit">Afmelden</button>
                </form>
              )}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="foot">
          <div className="wrap">
            <span>
              {site.company} · BTW {site.vat} · {site.address} · {site.email}
            </span>
            <nav aria-label="Juridisch">
              <Link href="/hoe-het-werkt">Hoe het werkt</Link>
              <Link href="/voorwaarden">Voorwaarden</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
