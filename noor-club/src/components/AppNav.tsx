import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Brand } from "@/components/Brand";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { logoutAction } from "@/actions/auth";

export async function AppNav({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <header className="no-print sticky top-0 z-40 border-b border-emerald-light bg-white/95 backdrop-blur">
      <nav
        aria-label={t("home")}
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <Brand href="/kinderen" />

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href="/kinderen"
            className="rounded-full px-3 py-2 text-sm font-bold text-emerald-dark hover:bg-emerald-light"
          >
            {t("children")}
          </Link>
          <Link
            href="/ouder"
            className="rounded-full px-3 py-2 text-sm font-bold text-emerald-dark hover:bg-emerald-light"
          >
            {t("parent")}
          </Link>
          <Link
            href="/account"
            className="rounded-full px-3 py-2 text-sm font-bold text-emerald-dark hover:bg-emerald-light"
          >
            {t("account")}
          </Link>

          <LocaleSwitcher label={tCommon("language")} />

          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="rounded-full px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
