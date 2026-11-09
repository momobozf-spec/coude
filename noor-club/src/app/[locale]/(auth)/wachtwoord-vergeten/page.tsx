import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { Card } from "@/components/ui/Card";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("forgot.title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{t("forgot.subtitle")}</p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-bold text-emerald underline">
          {t("forgot.backToLogin")}
        </Link>
      </p>
    </Card>
  );
}
