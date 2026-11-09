import Link from "next/link";
import { localeFromParams, href, formatDateTime } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { getProviderDashboardData, missingProfileFields } from "@/lib/services/providers";
import { pick, type MessageKey } from "@/i18n";
import { Alert, Badge, Card, Empty, LinkButton, PageTitle, SectionTitle } from "@/components/ui";
import { SubmitForReview } from "@/components/dashboard-widgets";

export default async function DashboardHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { user, provider } = (await getCurrentProvider())!;
  const data = await getProviderDashboardData(provider.id);
  const missing = provider.status === "draft" ? await missingProfileFields(provider.id) : [];
  const statusTone = provider.status === "active" ? "ok" : provider.status === "suspended" ? "danger" : "warn";
  const missingLabels: Record<string, string> = { base: t("prof.base_postcode"), categories: t("prof.categories"), availability: t("avail.title"), bio: t("prof.bio") };

  return (
    <div className="space-y-6">
      <PageTitle sub={t("dash.welcome", { name: user.name })}>{t("dash.title")}</PageTitle>
      <Alert tone={statusTone}>
        <p className="font-semibold">{t(`dash.status_${provider.status}` as MessageKey)}</p>
        {provider.status === "draft" && (
          <div className="mt-2 space-y-2">
            {missing.length > 0 && <p className="text-sm">{t("prof.incomplete", { fields: missing.map((m) => missingLabels[m] ?? m).join(", ") })}</p>}
            <SubmitForReview locale={locale} disabled={missing.length > 0} labels={{ submit: t("prof.submit_review"), done: t("prof.submitted"), loading: t("common.loading") }} />
          </div>
        )}
        {provider.status === "suspended" && provider.suspendedReason && <p className="text-sm">{provider.suspendedReason}</p>}
      </Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("dash.new_requests"), n: data.newRequests.length, href: "/dashboard/aanvragen" },
          { label: t("dash.upcoming"), n: data.upcoming.length, href: "/dashboard/opdrachten" },
          { label: t("dash.completed"), n: data.completed.length, href: "/dashboard/opdrachten" },
        ].map((s) => (
          <Link key={s.label} href={href(locale, s.href)} className="rounded-card border border-line bg-surface p-4 shadow-card hover:border-brand">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="text-3xl font-bold">{s.n}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <SectionTitle>{t("dash.new_requests")}</SectionTitle>
        {data.newRequests.length === 0 ? (
          <Empty>{t("dash.requests_empty")}</Empty>
        ) : (
          data.newRequests.slice(0, 5).map(({ request, match, category }) => (
            <Card key={request.id} as="article" className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{pick(category, "name", locale)}</Badge>
                  {request.urgent && <Badge tone="danger">{t("dash.request_urgent")}</Badge>}
                  <span className="text-sm text-muted">{t("dash.request_from", { municipality: `${request.postcode} ${request.municipality}` })} · {t("dash.request_distance", { km: match.distanceKm })}</span>
                </div>
                <p className="mt-1 line-clamp-2">{request.description}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(request.createdAt, locale)}</p>
              </div>
              <LinkButton href={href(locale, `/dashboard/aanvragen/${request.id}`)} variant="secondary" className="shrink-0">
                {t("common.details")}
              </LinkButton>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
