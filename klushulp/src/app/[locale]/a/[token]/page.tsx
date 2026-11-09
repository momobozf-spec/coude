import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { localeFromParams, formatDateTime, formatIsoDate } from "@/lib/locale";
import { getRequestByToken } from "@/lib/services/requests";
import { db } from "@/db";
import { message, provider as providerTable } from "@/db/schema";
import { pick, type MessageKey } from "@/i18n";
import { env } from "@/lib/env";
import { Alert, Badge, Card, Empty, PageTitle, SectionTitle } from "@/components/ui";
import { ProposalCard, ProviderHeader } from "@/components/proposal-card";
import { AcceptButton, BookingControls, CancelRequest, CopyLink, ExpandRequest, MessageThread, ReviewForm } from "@/components/customer-widgets";
import { providerPublicStats } from "@/lib/services/requests";

export const metadata: Metadata = { title: "Je aanvraag", robots: { index: false, follow: false } };

const LABEL_KEYS: MessageKey[] = [
  "mine.link_title", "mine.copy", "mine.copied", "prop.accept", "prop.accept_confirm_title", "prop.accept_confirm_text", "common.cancel", "common.loading", "common.error_generic", "mine.status_booked", "mine.messages", "mine.messages_empty",
  "mine.message_placeholder", "common.send", "mine.expand_title", "mine.expand_radius", "mine.expand_dates", "mine.expand_done", "mine.sent_no_matches", "mine.cancel_request", "mine.cancel_confirm", "common.yes", "common.no", "mine.booking_cancel",
  "mine.booking_cancel_reason", "mine.booking_report", "mine.status_cancelled", "report.reason", "report.reason_no_show", "report.reason_quality", "report.reason_price", "report.reason_behaviour", "report.reason_other", "report.details",
  "report.submitted", "common.back", "mine.review_help", "mine.review_rating", "mine.review_body", "mine.review_submit", "common.required", "common.optional",
];

export default async function CustomerRequestPage({ params, searchParams }: { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ nieuw?: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { token } = await params;
  const isNew = (await searchParams).nieuw === "1";
  const view = await getRequestByToken(token);
  const labels = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(k)]));

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert tone="danger">{t("mine.invalid_link")}</Alert>
      </div>
    );
  }
  const { request: req, category, photos, proposals, booking, review } = view;
  const url = `${env.baseUrl}/${locale}/a/${token}`;
  const statusKey = `mine.status_${req.status}` as MessageKey;
  const statusTone = req.status === "open" ? "brand" : req.status === "booked" ? "ok" : req.status === "completed" ? "ok" : "neutral";

  // Berichten per thread (klant ↔ dienstverlener), enkel voor gematchte dienstverleners.
  const providerIds = proposals.map((p) => p.provider.id);
  const msgs = providerIds.length ? await db.select().from(message).where(inArray(message.providerId, providerIds)).then((rows) => rows.filter((m) => m.requestId === req.id)) : [];
  const threadFor = (pid: string) => msgs.filter((m) => m.providerId === pid).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((m) => ({ id: m.id, senderRole: m.senderRole, body: m.body, at: formatDateTime(m.createdAt, locale) }));

  const bookedProvider = booking ? ((await db.select().from(providerTable).where(eq(providerTable.id, booking.providerId)).limit(1))[0] ?? null) : null;
  const bookedStats = bookedProvider ? (await providerPublicStats([bookedProvider.id]))[bookedProvider.id] : undefined;
  const bookedProposal = booking ? proposals.find((p) => p.proposal.id === booking.proposalId) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {isNew && (
        <Alert tone="ok">
          <p className="font-semibold">{t("mine.sent_title")}</p>
          <p>{req.matchCount > 0 ? t("mine.sent_matches", { n: req.matchCount }) : t("mine.sent_no_matches")}</p>
        </Alert>
      )}

      <Card>
        <p className="text-sm font-semibold">{t("mine.link_title")}</p>
        <p className="mb-2 text-sm text-muted">
          {t("mine.link_help")} {!env.smtpConfigured && t("mine.link_email_note")}
        </p>
        <CopyLink url={url} labels={labels} />
      </Card>

      <PageTitle sub={<Badge tone={statusTone}>{t(statusKey)}</Badge>}>{t("mine.title")}</PageTitle>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{category ? pick(category, "name", locale) : ""}</Badge>
          {req.urgent && <Badge tone="danger">{t("req.urgent_label")}</Badge>}
          <span className="text-sm text-muted">
            {req.postcode} {req.municipality}
          </span>
        </div>
        <p className="whitespace-pre-wrap">{req.description}</p>
        <p className="text-sm text-muted">
          {t("req.when_label")}: {req.dateFrom ? `${formatIsoDate(req.dateFrom, locale)}${req.dateTo && req.dateTo !== req.dateFrom ? ` – ${formatIsoDate(req.dateTo, locale)}` : ""}` : t("req.when_asap")} · {t(`req.time_${req.timePreference}` as MessageKey)}
        </p>
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((ph) => (
              <li key={ph.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${ph.path}?t=${encodeURIComponent(token)}`} alt="" className="size-20 rounded-lg border border-line object-cover" />
              </li>
            ))}
          </ul>
        )}
        {req.status === "open" && (
          <div className="pt-2">
            <CancelRequest locale={locale} token={token} labels={labels} />
          </div>
        )}
      </Card>

      {booking && bookedProvider && (
        <section className="space-y-3">
          <SectionTitle>{t("mine.booking_title")}</SectionTitle>
          <Card className="space-y-4">
            <ProviderHeader provider={bookedProvider} stats={bookedStats} locale={locale} t={t} link />
            <div className="rounded-xl bg-paper p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("common.date")}</p>
              <p className="text-lg font-bold">{formatDateTime(booking.scheduledStart, locale)}</p>
              <p className="text-sm text-muted">{t("mine.booking_address_shared", { name: bookedProvider.displayName })}</p>
              {bookedProvider.phone && <p className="mt-1 text-sm">{t("req.contact_phone")}: {bookedProvider.phone}</p>}
            </div>
            <Badge tone={booking.status === "completed" ? "ok" : booking.status === "cancelled" ? "neutral" : booking.status === "disputed" ? "warn" : "brand"}>{t(`mine.status_${booking.status === "completed" ? "completed" : booking.status === "cancelled" ? "cancelled" : "booked"}` as MessageKey)}</Badge>
            {bookedProposal && <MessageThread locale={locale} token={token} providerId={bookedProvider.id} messages={threadFor(bookedProvider.id)} labels={labels} />}
            {booking.status !== "cancelled" && <BookingControls locale={locale} token={token} canCancel={["confirmed", "in_progress"].includes(booking.status)} labels={labels} />}
          </Card>
          {booking.status === "completed" && (
            <Card>
              <SectionTitle className="mb-3">{t("mine.review_title")}</SectionTitle>
              {review ? <Alert tone="ok">{t("mine.review_done")}</Alert> : <ReviewForm locale={locale} token={token} labels={labels} />}
            </Card>
          )}
        </section>
      )}

      {!booking && (
        <section className="space-y-3">
          <SectionTitle>{t("mine.proposals_title")}</SectionTitle>
          {proposals.filter((p) => p.proposal.status === "sent").length > 1 && <p className="text-sm text-muted">{t("mine.compare_hint")}</p>}
          {proposals.length === 0 && (
            <>
              <Empty>{req.matchCount > 0 ? t("mine.proposals_empty") : t("mine.sent_no_matches")}</Empty>
              {req.status === "open" && (
                <Card>
                  <ExpandRequest locale={locale} token={token} labels={labels} />
                </Card>
              )}
            </>
          )}
          {proposals.map(({ proposal: p, provider: pr, stats }) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              provider={pr}
              stats={stats}
              locale={locale}
              t={t}
              status={p.status !== "sent" ? <Badge tone="neutral">{t(`prop.${p.status === "withdrawn" ? "withdrawn" : "declined"}` as MessageKey)}</Badge> : undefined}
              action={req.status === "open" && p.status === "sent" ? <AcceptButton locale={locale} token={token} proposalId={p.id} providerName={pr.displayName} dateLabel={formatDateTime(p.proposedStart, locale)} labels={labels} /> : undefined}
              footer={<MessageThread locale={locale} token={token} providerId={pr.id} messages={threadFor(pr.id)} labels={labels} disabled={req.status !== "open"} />}
            />
          ))}
          {proposals.length > 0 && req.status === "open" && (
            <Card>
              <ExpandRequest locale={locale} token={token} labels={labels} />
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
