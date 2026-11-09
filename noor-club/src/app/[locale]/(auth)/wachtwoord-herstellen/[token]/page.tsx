import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { hashToken, isUsable } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });

  // Checked here purely so an expired link shows an explanation instead of a
  // form that will fail on submit. The action re-checks; this is not the gate.
  const record = await db.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });

  if (!record || !isUsable(record)) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-emerald-dark">
          {t("reset.invalidTitle")}
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">{t("reset.invalidBody")}</p>
        <Link
          href="/wachtwoord-vergeten"
          className={buttonClasses("primary", "lg", "w-full")}
        >
          {t("reset.requestNew")}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("reset.title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{t("reset.subtitle")}</p>

      <ResetPasswordForm token={token} />
    </Card>
  );
}
