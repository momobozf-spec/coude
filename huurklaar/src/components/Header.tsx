"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";

export function Header({ lang, t, loggedIn }: { lang: Locale; t: Dict; loggedIn: boolean }) {
  const path = usePathname() ?? `/${lang}`;
  const rest = path.replace(/^\/(nl|fr)/, "");
  const cur = (href: string) => (path === href ? "page" : undefined);

  function setLangCookie(l: Locale) {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link href={`/${lang}`} className="logo">Huur<span>klaar</span></Link>
        <nav className="nav" aria-label="Hoofdmenu">
          <Link href={`/${lang}/dossier`} aria-current={cur(`/${lang}/dossier`)}>{t.nav.dossier}</Link>
          <Link href={`/${lang}/check`} aria-current={cur(`/${lang}/check`)}>{t.nav.check}</Link>
          <Link href={`/${lang}/prijzen`} aria-current={cur(`/${lang}/prijzen`)}>{t.nav.pricing}</Link>
          {loggedIn ? (
            <>
              <Link href={`/${lang}/matches`} aria-current={cur(`/${lang}/matches`)}>{t.nav.matches}</Link>
              <Link href={`/${lang}/kandidaturen`} aria-current={cur(`/${lang}/kandidaturen`)}>{t.nav.apps}</Link>
              <Link href={`/${lang}/account`} aria-current={cur(`/${lang}/account`)}>{t.nav.account}</Link>
              <form action="/auth/logout" method="post">
                <input type="hidden" name="lang" value={lang} />
                <button className="linkbtn" type="submit">{t.nav.logout}</button>
              </form>
            </>
          ) : (
            <Link className="btn btn-primary btn-sm" href={`/${lang}/login?next=${encodeURIComponent(path)}`}>{t.nav.login}</Link>
          )}
          <span className="lang" role="group" aria-label="Taal / Langue">
            <a href={`/nl${rest}`} aria-current={lang === "nl"} onClick={() => setLangCookie("nl")}>NL</a>
            <a href={`/fr${rest}`} aria-current={lang === "fr"} onClick={() => setLangCookie("fr")}>FR</a>
          </span>
        </nav>
      </div>
    </header>
  );
}
