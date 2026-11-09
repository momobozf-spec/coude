import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Brand } from "@/components/Brand";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-emerald-light/50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Brand />
        <LocaleSwitcher label={t("language")} />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 pb-12">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
