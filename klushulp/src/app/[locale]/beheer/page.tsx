import Link from "next/link";
import { localeFromParams, href } from "@/lib/locale";
import { adminOverview } from "@/lib/services/admin";
import { env } from "@/lib/env";
import { Badge, Card, PageTitle, SectionTitle } from "@/components/ui";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const o = await adminOverview();
  const tiles = [
    { label: t("admin.nav_providers"), n: o.pendingProviders, href: "/beheer/dienstverleners", sub: t("ver.status_pending") },
    { label: t("admin.nav_verifications"), n: o.pendingVerifications, href: "/beheer/dienstverleners", sub: t("ver.status_pending") },
    { label: t("admin.nav_requests"), n: o.openRequests, href: "/beheer/aanvragen", sub: t("mine.status_open") },
    { label: t("admin.nav_bookings"), n: o.activeBookings, href: "/beheer/boekingen", sub: t("mine.status_booked") },
    { label: t("admin.nav_reports"), n: o.openReports, href: "/beheer/meldingen", sub: t("ver.status_pending") },
  ];
  const integrations = [
    { label: t("admin.integration_payments"), on: env.stripeConfigured },
    { label: t("admin.integration_email"), on: env.smtpConfigured },
    { label: t("admin.integration_ai"), on: env.aiConfigured },
  ];
  return (
    <div className="space-y-6">
      <PageTitle>{t("admin.nav_overview")}</PageTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((x) => (
          <Link key={x.label} href={href(locale, x.href)} className="rounded-card border border-line bg-surface p-4 shadow-card hover:border-brand">
            <p className="text-sm text-muted">{x.label}</p>
            <p className="text-3xl font-bold">{x.n}</p>
            <p className="text-xs text-muted">{x.sub}</p>
          </Link>
        ))}
      </div>
      <Card>
        <SectionTitle className="mb-3">{t("admin.integrations")}</SectionTitle>
        <ul className="space-y-2">
          {integrations.map((i) => (
            <li key={i.label} className="flex items-center justify-between">
              <span>{i.label}</span>
              <Badge tone={i.on ? "ok" : "neutral"}>{i.on ? t("admin.integration_on") : t("admin.integration_off")}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
