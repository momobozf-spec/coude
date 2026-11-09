import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/entitlement";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Single gate for the whole authenticated area. Middleware only checks that a
  // session cookie exists; this is where the session is actually validated.
  await requireUser();

  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="flex min-h-[100dvh] flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <a
        href="#main"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-emerald focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <AppNav locale={locale} />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
