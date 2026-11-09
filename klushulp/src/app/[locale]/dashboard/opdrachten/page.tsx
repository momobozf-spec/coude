import { localeFromParams, href, formatDateTime } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { getProviderDashboardData } from "@/lib/services/providers";
import type { MessageKey } from "@/i18n";
import { Badge, Card, Empty, LinkButton, PageTitle, SectionTitle } from "@/components/ui";

export default async function JobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { provider } = (await getCurrentProvider())!;
  const data = await getProviderDashboardData(provider.id);
  const tone = (s: string) => (s === "completed" ? "ok" : s === "cancelled" ? "neutral" : s === "disputed" ? "warn" : "brand");
  const renderList = (items: typeof data.upcoming) =>
    items.length ? (
      <div className="space-y-3">
        {items.map(({ booking, request }) => (
          <Card key={booking.id} as="article" className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone(booking.status)}>{t(`mine.status_${booking.status === "completed" ? "completed" : booking.status === "cancelled" ? "cancelled" : "booked"}` as MessageKey)}</Badge>
                <span className="text-sm font-semibold">{formatDateTime(booking.scheduledStart, locale)}</span>
              </div>
              <p className="mt-1 line-clamp-2">{request.description}</p>
              <p className="text-sm text-muted">
                {request.postcode} {request.municipality}
              </p>
            </div>
            <LinkButton href={href(locale, `/dashboard/opdrachten/${booking.id}`)} variant="secondary" className="shrink-0">
              {t("common.details")}
            </LinkButton>
          </Card>
        ))}
      </div>
    ) : (
      <Empty>{t("dash.jobs_empty")}</Empty>
    );
  return (
    <div className="space-y-6">
      <PageTitle>{t("dash.nav_jobs")}</PageTitle>
      <section className="space-y-3">
        <SectionTitle>{t("dash.upcoming")}</SectionTitle>
        {renderList(data.upcoming)}
      </section>
      <section className="space-y-3">
        <SectionTitle>{t("dash.completed")}</SectionTitle>
        {renderList(data.completed)}
      </section>
      {data.other.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>{t("common.status")}</SectionTitle>
          {renderList(data.other)}
        </section>
      )}
    </div>
  );
}
