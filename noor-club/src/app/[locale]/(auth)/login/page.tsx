import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/navigation";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/components/forms/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.id) redirect(`/${locale}/kinderen`);

  const { next } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.login" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{t("subtitle")}</p>

      <LoginForm next={next} />

      <p className="mt-4 text-center text-sm">
        <Link href="/wachtwoord-vergeten" className="font-bold text-emerald underline">
          {tAuth("forgot.link")}
        </Link>
      </p>

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-bold text-emerald underline">
          {t("toRegister")}
        </Link>
      </p>
    </Card>
  );
}
