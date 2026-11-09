import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { localeFromParams, href } from "@/lib/locale";
import { getCurrentUser } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const user = await getCurrentUser();
  if (user) redirect(href(locale, user.role === "admin" ? "/beheer" : user.role === "provider" ? "/dashboard" : "/"));
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageTitle>{t("auth.login_title")}</PageTitle>
      <Card>
        <LoginForm labels={{ email: t("auth.email"), password: t("auth.password"), submit: t("auth.login"), failed: t("auth.login_failed"), loading: t("common.loading") }} redirectTo={href(locale, "/dashboard")} />
      </Card>
      <p className="mt-4 text-sm text-muted">
        {t("auth.no_account")}{" "}
        <Link href={href(locale, "/dienstverlener-worden")} className="font-semibold text-brand underline-offset-4 hover:underline">
          {t("auth.register_link")}
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">{t("auth.customer_note")}</p>
    </div>
  );
}
