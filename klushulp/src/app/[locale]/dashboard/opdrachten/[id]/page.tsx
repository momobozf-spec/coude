import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { getBookingForProvider } from "@/lib/services/bookings";
import { db } from "@/db";
import { category, jobRequest, proposal, review } from "@/db/schema";
import { listThread } from "@/lib/services/messages";
import { formatCents } from "@/lib/money";
import { pick, type MessageKey } from "@/i18n";
import { Alert, Badge, Card, DescriptionList, PageTitle, SectionTitle } from "@/components/ui";
import { ProposalCard } from "@/components/proposal-card";
import { BookingActions, ProviderThread } from "@/components/dashboard-widgets";

export default async function JobDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { id } = await params;
  const { provider } = (await getCurrentProvider())!;
  const bk = await getBookingForProvider(provider.id, id);
  if (!bk) notFound();
  const [row] = await db.select({ request: jobRequest, category }).from(jobRequest).innerJoin(category, eq(category.id, jobRequest.categoryId)).where(eq(jobRequest.id, bk.requestId)).limit(1);
  const [prop] = await db.select().from(proposal).where(eq(proposal.id, bk.proposalId)).limit(1);
  const [rv] = await db.select().from(review).where(eq(review.bookingId, bk.id)).limit(1);
  const thread = await listThread(bk.requestId, provider.id);
  const req = row.request;
  const labels = { "dash.job_start": t("dash.job_start"), "dash.job_complete": t("dash.job_complete"), "dash.job_cancel": t("dash.job_cancel"), "mine.booking_cancel_reason": t("mine.booking_cancel_reason"), "common.back": t("common.back"), "common.error_generic": t("common.error_generic"), "common.send": t("common.send"), "mine.messages": t("mine.messages"), "mine.messages_empty": t("mine.messages_empty") };
  const statusLabel = t(`mine.status_${bk.status === "completed" ? "completed" : bk.status === "cancelled" ? "cancelled" : "booked"}` as MessageKey);

  return (
    <div className="space-y-6">
      <PageTitle sub={<span >{formatDateTime(bk.scheduledStart, locale)}</span>}>{pick(row.category, "name", locale)}</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Badge tone={bk.status === "completed" ? "ok" : bk.status === "cancelled" ? "neutral" : bk.status === "disputed" ? "warn" : "brand"}>{statusLabel}</Badge>
        {bk.status === "disputed" && <Badge tone="warn">{t("report.title")}</Badge>}
        <Badge tone="neutral">
          {t("prop.platform_fee")}: {formatCents(bk.platformFeeCents, locale)} · {bk.paymentProvider === "simulated" ? "gesimuleerd / simulé" : bk.paymentStatus}
        </Badge>
      </div>
      {bk.status === "completed" && <Alert tone="ok">{t("dash.job_completed_note")}</Alert>}

      <Card className="space-y-3">
        <SectionTitle>{t("dash.customer")}</SectionTitle>
        {/* Contactgegevens en adres: enkel hier, na acceptatie. */}
        <DescriptionList
          items={[
            { k: t("req.contact_name"), v: req.contactName },
            { k: t("req.contact_email"), v: <a className="text-brand underline-offset-4 hover:underline" href={`mailto:${req.contactEmail}`}>{req.contactEmail}</a> },
            { k: t("req.contact_phone"), v: req.contactPhone ? <a className="text-brand underline-offset-4 hover:underline" href={`tel:${req.contactPhone}`}>{req.contactPhone}</a> : t("common.unknown") },
            { k: t("req.street_label"), v: [req.streetAddress, `${req.postcode} ${req.municipality}`].filter(Boolean).join(", ") },
          ]}
        />
        <p className="whitespace-pre-wrap border-t border-line pt-3">{req.description}</p>
        <BookingActions locale={locale} bookingId={bk.id} status={bk.status} labels={labels} />
      </Card>

      {prop && <ProposalCard proposal={prop} provider={provider} stats={undefined} locale={locale} t={t} />}

      {rv && (
        <Card>
          <SectionTitle className="mb-2">{t("browse.profile_reviews")}</SectionTitle>
          <p className="text-accent" aria-label={`${rv.rating}/5`}>
            {"★".repeat(rv.rating)}
            <span className="text-line-strong">{"★".repeat(5 - rv.rating)}</span>
          </p>
          {rv.body && <p className="mt-1 whitespace-pre-wrap">{rv.body}</p>}
          <p className="mt-1 text-sm text-muted">{rv.authorName}</p>
        </Card>
      )}

      <section className="space-y-3">
        <SectionTitle>{t("mine.messages")}</SectionTitle>
        <Card>
          <ProviderThread locale={locale} requestId={bk.requestId} messages={thread.map((m) => ({ id: m.id, senderRole: m.senderRole, body: m.body, at: formatDateTime(m.createdAt, locale) }))} labels={labels} disabled={bk.status === "cancelled"} />
        </Card>
      </section>
    </div>
  );
}
