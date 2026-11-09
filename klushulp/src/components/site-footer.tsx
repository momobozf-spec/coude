import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n";
import { href } from "@/lib/locale";
import { env } from "@/lib/env";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{env.legal.name ? t("footer.operator", { name: env.legal.name }) : t("app.name")}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href={href(locale, "/juridisch")} className="hover:text-brand-strong">
            {t("footer.legal")}
          </Link>
          <Link href={href(locale, "/dienstverlener-worden")} className="hover:text-brand-strong">
            {t("nav.for_providers")}
          </Link>
          <Link href={href(locale, "/zoeken")} className="hover:text-brand-strong">
            {t("nav.browse")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
