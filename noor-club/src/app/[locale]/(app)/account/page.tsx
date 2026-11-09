import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/entitlement";
import { Card, CardTitle, SectionHeading } from "@/components/ui/Card";
import { Chip } from "@/components/ui/StatTile";
import { CheckoutButton, PortalButton } from "@/components/CheckoutButton";
import { LanguageForm } from "@/components/forms/LanguageForm";
import { DangerZone } from "@/components/forms/DangerZone";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { logoutAction } from "@/actions/auth";
import { buttonClasses } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    welcome?: string;
    canceled?: string;
    billing?: string;
  }>;
}) {
  const { locale } = await params;
  const { welcome, canceled, billing } = await searchParams;
  setRequestLocale(locale);

  const user = await requireUser();
  const t = await getTranslations({ locale, namespace: "account" });
  const tRoot = await getTranslations({ locale });

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const verified = user.emailVerifiedAt !== null;

  const statusTone =
    user.subStatus === "ACTIVE" || user.subStatus === "TRIALING"
      ? "emerald"
      : user.subStatus === "PAST_DUE"
        ? "gold"
        : "muted";

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />

      {!verified ? <VerifyEmailBanner locale={locale} /> : null}

      {welcome ? (
        <Banner tone="emerald" title={t("welcomeTitle")} body={t("welcomeBody")} />
      ) : null}
      {canceled ? (
        <Banner tone="muted" title={t("canceledTitle")} body={t("canceledBody")} />
      ) : null}
      {billing === "error" ? (
        <Banner
          tone="danger"
          title={t("pastDueTitle")}
          body={tRoot("errors.stripeNotConfigured")}
        />
      ) : null}
      {billing === "unverified" ? (
        <Banner
          tone="danger"
          title={t("pastDueTitle")}
          body={tRoot("errors.emailNotVerified")}
        />
      ) : null}
      {billing === "consent" ? (
        <Banner tone="danger" title={t("pastDueTitle")} body={t("consentRequired")} />
      ) : null}
      {user.subStatus === "PAST_DUE" ? (
        <Banner tone="danger" title={t("pastDueTitle")} body={t("pastDueBody")} />
      ) : null}

      <Card>
        <CardTitle>{t("subscription")}</CardTitle>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">{t("statusLabel")}:</span>
          <Chip tone={statusTone}>{t(`status.${user.subStatus}`)}</Chip>
        </div>

        {user.currentPeriodEnd ? (
          <p className="mt-2 text-sm text-slate-600">
            {user.subStatus === "TRIALING"
              ? t("trialEndsOn", { date: dateFormat.format(user.currentPeriodEnd) })
              : t("renewsOn", { date: dateFormat.format(user.currentPeriodEnd) })}
          </p>
        ) : null}

        {user.isSubscribed ? (
          <div className="mt-5">
            <PortalButton locale={locale} label={t("manage")} />
          </div>
        ) : (
          <div className="mt-5 rounded-card bg-gold-light p-5">
            <p className="text-lg font-extrabold text-emerald-dark">{t("offerTitle")}</p>
            <p className="mt-1 text-sm text-slate-700">{t("offerBody")}</p>

            <div className="mt-4">
              <CheckoutButton
                locale={locale}
                label={t("subscribe")}
                consentLabel={t("consentWithdrawal")}
                disabled={!verified}
              />
            </div>

            {/* Shown before the button is pressed, never after. */}
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-700">
              {t("disclaimer")}
            </p>
          </div>
        )}

        {!user.isSubscribed && user.stripeCustomerId ? (
          <div className="mt-4">
            <PortalButton locale={locale} label={t("manage")} variant="ghost" size="sm" />
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle>{t("profile")}</CardTitle>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-slate-500">{t("name")}</dt>
            <dd className="text-slate-800">{user.name}</dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("email")}</dt>
            <dd className="break-all text-slate-800">
              {user.email}{" "}
              {verified ? (
                <span className="text-emerald" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <LanguageForm />
        </div>
      </Card>

      <Card>
        <CardTitle>{t("exportTitle")}</CardTitle>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("exportBody")}</p>
        <div className="mt-4">
          <a href="/api/account/export" className={buttonClasses("secondary", "md")}>
            {t("exportCta")}
          </a>
        </div>
      </Card>

      <form action={logoutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className={buttonClasses("ghost", "md")}>
          {t("signOut")}
        </button>
      </form>

      <DangerZone email={user.email} />
    </div>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "emerald" | "muted" | "danger";
  title: string;
  body: string;
}) {
  const tones = {
    emerald: "bg-emerald-light text-emerald-dark",
    muted: "bg-slate-100 text-slate-700",
    danger: "bg-red-50 text-red-800",
  } as const;

  return (
    <div className={`rounded-card p-5 ${tones[tone]}`} role="status">
      <p className="font-extrabold">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  );
}
