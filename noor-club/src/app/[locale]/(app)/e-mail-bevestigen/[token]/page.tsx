import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { hashToken, isUsable } from "@/lib/tokens";
import { requireUser } from "@/lib/entitlement";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { ResendVerification } from "@/components/forms/ResendVerification";
import { hashed, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Confirms the address and burns the token.
 *
 * A GET that mutates is normally a smell, but an e-mail link is a GET and there
 * is no way around it. It is safe here because the token is single-use, random
 * and short-lived: replaying the link a second time simply says "already used".
 */
export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "verify" });
  const log = logger("auth.verify");

  // The signed-in user is only used for the "resend" button; confirming works
  // from any device, including the phone the mail was opened on.
  await requireUser();

  const record = await db.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record || !isUsable(record)) {
    log.warn("verify token rejected", { found: record !== null });
    return (
      <Card className="mx-auto max-w-md p-6 sm:p-8">
        <p className="text-4xl" aria-hidden="true">
          ⏳
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-emerald-dark">
          {t("invalidTitle")}
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">{t("invalidBody")}</p>
        <ResendVerification />
      </Card>
    );
  }

  await db.$transaction([
    db.emailVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  log.info("email verified", { user: hashed(record.userId) });

  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8 text-center">
      <p className="text-4xl" aria-hidden="true">
        ✅
      </p>
      <h1 className="mt-2 text-2xl font-extrabold text-emerald-dark">{t("doneTitle")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{t("doneBody")}</p>
      <Link href="/kinderen" className={buttonClasses("primary", "lg")}>
        {t("continue")}
      </Link>
    </Card>
  );
}
