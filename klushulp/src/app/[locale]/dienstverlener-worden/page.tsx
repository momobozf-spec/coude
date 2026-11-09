import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { localeFromParams, href } from "@/lib/locale";
import { getCurrentUser } from "@/lib/session";
import { getActiveRegions } from "@/lib/catalog";
import { getFeeConfig, formatBps } from "@/lib/fees";
import { formatCents } from "@/lib/money";
import { pick } from "@/i18n";
import { Card, PageTitle } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Ontvang opdrachten" };

export default async function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const user = await getCurrentUser();
  if (user?.role === "provider") redirect(href(locale, "/dashboard"));
  const [regions, fee] = await Promise.all([getActiveRegions(), getFeeConfig()]);
  const regionNames = regions.map((r) => pick(r, "name", locale)).join(", ");
  const labelKeys = ["join.name", "join.business_name", "join.kbo", "join.kbo_invalid", "join.type_label", "join.type_professional", "join.type_private", "join.type_private_note", "join.password_help", "join.submit", "join.email_exists", "join.terms", "auth.email", "auth.password", "common.required", "common.error_generic", "common.loading", "req.rate_limited"] as const;
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(k)]));
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageTitle sub={t("join.intro", { region: regionNames })}>{t("join.title")}</PageTitle>
      <ol className="mb-6 grid gap-3 sm:grid-cols-3">
        {[t("join.how_1"), t("join.how_2"), t("join.how_3", { fee: formatBps(fee.feeBps), min: formatCents(fee.feeMinCents, locale) })].map((s, i) => (
          <li key={i} className="rounded-card border border-line bg-surface p-4 text-sm">
            <span className="mb-1 block font-bold text-brand">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <Card>
        <p className="mb-4 text-sm text-muted">{t("join.pro_required")}</p>
        <RegisterForm locale={locale} labels={labels} redirectTo={href(locale, "/dashboard/profiel")} />
      </Card>
    </div>
  );
}
