import { localeFromParams, href, formatDateTime } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { getProviderDashboardData } from "@/lib/services/providers";
import { pick, type MessageKey } from "@/i18n";
import { Badge, Card, Empty, LinkButton, PageTitle, SectionTitle } from "@/components/ui";

export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { provider } = (await getCurrentProvider())!;
  const data = await getProviderDashboardData(provider.id);
  const statusOf = (requestId: string) => data.proposals.find((p) => p.requestId === requestId)?.status;
  const renderList = (items: typeof data.newRequests) => (
    <div className="space-y-3">
      {items.map(({ request, match, category }) => {
        const st = statusOf(request.id);
        return (
          <Card key={request.id} as="article" className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{pick(category, "name", locale)}</Badge>
                {request.urgent && <Badge tone="danger">{t("dash.request_urgent")}</Badge>}
                <Badge tone={match.availableInWindow ? "ok" : "warn"}>{match.availableInWindow ? t("dash.request_available") : t("dash.request_not_available")}</Badge>
                {st && <Badge tone="neutral">{t(`dash.proposal_status_${st}` as MessageKey)}</Badge>}
              </div>
              <p className="mt-1 line-clamp-2">{request.description}</p>
              <p className="mt-1 text-sm text-muted">
                {request.postcode} {request.municipality} · {t("dash.request_distance", { km: match.distanceKm })} · {formatDateTime(request.createdAt, locale)}
              </p>
            </div>
            <LinkButton href={href(locale, `/dashboard/aanvragen/${request.id}`)} variant="secondary" className="shrink-0">
              {t("common.details")}
            </LinkButton>
          </Card>
        );
      })}
    </div>
  );
  return (
    <div className="space-y-6">
      <PageTitle>{t("dash.nav_requests")}</PageTitle>
      <section className="space-y-3">
        <SectionTitle>{t("dash.new_requests")}</SectionTitle>
        {data.newRequests.length ? renderList(data.newRequests) : <Empty>{t("dash.requests_empty")}</Empty>}
      </section>
      {data.respondedRequests.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>{t("dash.my_proposals")}</SectionTitle>
          renderList(data.respondedRequests)
        </section>
      )}
    </div>
  );
}
