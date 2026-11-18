import Link from "next/link";
import { BRAND, BRAND_LOWER } from "@/lib/brand";
import { LOCALES, getDict, type Locale } from "@/i18n/dictionaries";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="30" height="28" viewBox="0 0 30 28" aria-hidden="true">
        <path d="M4 2h22a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H11l-7 6v-6H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#ff5da2" />
        <circle cx="9.5" cy="11.5" r="2" fill="#2b1260" />
        <circle cx="15" cy="11.5" r="2" fill="#2b1260" />
        <circle cx="20.5" cy="11.5" r="2" fill="#2b1260" />
      </svg>
      <span className="display text-[28px]">{BRAND_LOWER}</span>
    </span>
  );
}

export function Header({ locale, path = "" }: { locale: Locale; path?: string }) {
  const d = getDict(locale);
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:gap-4 sm:px-6">
      <Link href={`/${locale}`} aria-label={BRAND}>
        <Logo />
      </Link>
      <nav aria-label={d.nav.language} className="flex items-center gap-0.5 text-sm font-bold sm:gap-1">
        {LOCALES.map((l) => (
          <Link
            key={l}
            href={`/${l}${path}`}
            hrefLang={l}
            aria-current={l === locale ? "true" : undefined}
            className={`rounded-full px-2 py-1 sm:px-2.5 ${l === locale ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"}`}
          >
            {l.toUpperCase()}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <footer className="mx-auto mt-24 max-w-6xl border-t-2 border-line px-4 py-10 text-sm text-ink-soft sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>{d.footer.operator}</p>
        <nav className="flex gap-5 font-semibold">
          <Link href={`/${locale}/privacy`}>{d.nav.privacy}</Link>
          <Link href={`/${locale}/terms`}>{d.nav.terms}</Link>
          <Link href={`/${locale}/imprint`}>{d.nav.imprint}</Link>
        </nav>
      </div>
      <p className="mt-4 text-xs">{d.footer.trademark}</p>
    </footer>
  );
}
