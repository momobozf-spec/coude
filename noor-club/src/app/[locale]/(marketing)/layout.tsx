import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { Brand } from "@/components/Brand";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { buttonClasses } from "@/components/ui/Button";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tFooter = await getTranslations({ locale, namespace: "marketing.footer" });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="border-b border-emerald-light">
        <nav
          aria-label={t("home")}
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4"
        >
          <Brand />
          <div className="flex items-center gap-2">
            <LocaleSwitcher label={tCommon("language")} />
            <Link href="/login" className={buttonClasses("ghost", "sm")}>
              {t("login")}
            </Link>
            <Link href="/register" className={buttonClasses("primary", "sm")}>
              {t("register")}
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-emerald-light bg-emerald-light/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-slate-600">
          <Brand />
          <p>{tFooter("tagline")}</p>
          <p className="flex flex-wrap gap-4">
            <Link href="/privacy" className="font-bold text-emerald underline">
              {t("privacy")}
            </Link>
            <Link href="/voorwaarden" className="font-bold text-emerald underline">
              {t("terms")}
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Noor Club. {tFooter("rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
