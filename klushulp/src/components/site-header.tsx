import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n";
import { href } from "@/lib/locale";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export async function SiteHeader({ locale, currentPath }: { locale: Locale; currentPath: string }) {
  const t = getT(locale);
  const user = await getCurrentUser();
  const other: Locale = locale === "nl" ? "fr" : "nl";
  const switchHref = `/${other}${currentPath.replace(/^\/(nl|fr)/, "")}`;
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={href(locale, "/")} className="flex items-center gap-2 font-bold text-ink">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-white text-sm">K</span>
          <span>{t("app.name")}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Hoofdnavigatie">
          <Link href={href(locale, "/zoeken")} className="hidden sm:inline-flex rounded-lg px-3 py-2 text-muted hover:bg-brand-soft hover:text-brand-strong">
            {t("nav.browse")}
          </Link>
          {!user && (
            <Link href={href(locale, "/dienstverlener-worden")} className="hidden sm:inline-flex rounded-lg px-3 py-2 text-muted hover:bg-brand-soft hover:text-brand-strong">
              {t("nav.for_providers")}
            </Link>
          )}
          {user?.role === "provider" && (
            <Link href={href(locale, "/dashboard")} className="rounded-lg px-3 py-2 font-semibold text-brand hover:bg-brand-soft">
              {t("nav.dashboard")}
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href={href(locale, "/beheer")} className="rounded-lg px-3 py-2 font-semibold text-brand hover:bg-brand-soft">
              {t("nav.admin")}
            </Link>
          )}
          {user ? (
            <LogoutButton label={t("nav.logout")} redirectTo={href(locale, "/")} />
          ) : (
            <Link href={href(locale, "/login")} className="rounded-lg px-3 py-2 text-muted hover:bg-brand-soft hover:text-brand-strong">
              {t("nav.login")}
            </Link>
          )}
          <Link href={switchHref} hrefLang={other} lang={other} className="ml-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold uppercase text-muted hover:border-brand hover:text-brand-strong" aria-label={t("nav.language")}>
            {other}
          </Link>
        </nav>
      </div>
    </header>
  );
}
