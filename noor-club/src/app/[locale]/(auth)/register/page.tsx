import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/navigation";
import { Card } from "@/components/ui/Card";
import { RegisterForm } from "@/components/forms/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.id) redirect(`/${locale}/kinderen`);

  const t = await getTranslations({ locale, namespace: "auth.register" });

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{t("subtitle")}</p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-bold text-emerald underline">
          {t("toLogin")}
        </Link>
      </p>
    </Card>
  );
}
