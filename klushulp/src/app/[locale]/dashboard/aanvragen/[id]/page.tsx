import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { localeFromParams, formatDateTime, formatIsoDate } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { db } from "@/db";
import { category, jobPhoto, jobRequest, proposal, requestMatch } from "@/db/schema";
import { listThread } from "@/lib/services/messages";
import { getFeeConfig, formatBps } from "@/lib/fees";
import { formatCents } from "@/lib/money";
import { pick, type MessageKey } from "@/i18n";
import { Alert, Badge, Card, PageTitle, SectionTitle } from "@/components/ui";
import { ProposalCard } from "@/components/proposal-card";
import { ProposalForm, ProviderThread, WithdrawProposal } from "@/components/dashboard-widgets";
import { suggestedStartFor } from "@/lib/suggest-start";

const KEYS: MessageKey[] = ["pf.price_type", "prop.price_fixed", "prop.price_hourly", "prop.price_estimate", "prop.price_inspection", "prop.estimate_note", "prop.inspection_note", "pf.amount", "pf.amount_min", "pf.amount_max", "pf.hourly_rate", "pf.hours_min", "pf.hours_max", "pf.inspection_amount", "pf.travel_fee", "pf.materials_included", "pf.materials_note", "pf.included", "pf.excluded", "pf.start", "pf.duration", "pf.message", "pf.fee_preview", "pf.fee_explain", "pf.invalid_amount", "pf.invalid_range", "pf.invalid_start", "pf.already_sent", "dash.request_closed", "dash.send_proposal", "dash.proposal_withdraw", "common.optional", "common.loading", "common.error_generic", "common.send", "common.back", "mine.messages", "mine.messages_empty"];

export default async function RequestDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { id } = await params;
  const { provider } = (await getCurrentProvider())!;
  // Autorisatie: enkel als er een match bestaat voor deze dienstverlener.
  const [match] = await db.select().from(requestMatch).where(and(eq(requestMatch.requestId, id), eq(requestMatch.providerId, provider.id))).limit(1);
  if (!match) notFound();
  const [row] = await db.select({ request: jobRequest, category }).from(jobRequest).innerJoin(category, eq(category.id, jobRequest.categoryId)).where(eq(jobRequest.id, id)).limit(1);
  if (!row) notFound();
  const { request: req } = row;
  const photos = await db.select().from(jobPhoto).where(eq(jobPhoto.requestId, id));
  const [mine] = await db.select().from(proposal).where(and(eq(proposal.requestId, id), eq(proposal.providerId, provider.id))).limit(1);
  const thread = await listThread(id, provider.id);
  const fee = await getFeeConfig();
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(k)]));
  const isOpen = req.status === "open" && req.expiresAt > new Date();
  const questions = row.category.followupQuestions;

  const suggestedStart = suggestedStartFor(req.dateFrom);

  return (
    <div className="space-y-6">
      <PageTitle sub={`${req.postcode} ${req.municipality} · ${t("dash.request_distance", { km: match.distanceKm })}`}>{pick(row.category, "name", locale)}</PageTitle>
      {!isOpen && <Alert tone="warn">{t("dash.request_closed")}</Alert>}
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {req.urgent && <Badge tone="danger">{t("dash.request_urgent")}</Badge>}
          <Badge tone={match.availableInWindow ? "ok" : "warn"}>{match.availableInWindow ? t("dash.request_available") : t("dash.request_not_available")}</Badge>
          {req.isDemo && <Badge tone="warn">{t("common.demo_badge")}</Badge>}
        </div>
        <p className="whitespace-pre-wrap">{req.description}</p>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t("dash.request_period")}</dt>
          <dd>
            {req.dateFrom ? `${formatIsoDate(req.dateFrom, locale)}${req.dateTo && req.dateTo !== req.dateFrom ? ` – ${formatIsoDate(req.dateTo, locale)}` : ""}` : t("dash.request_asap")} · {t(`req.time_${req.timePreference}` as MessageKey)}
          </dd>
          {Object.entries(req.answers).map(([k, v]) => {
            const q = questions.find((x) => x.key === k);
            const label = q ? (locale === "fr" ? q.labelFr : q.labelNl) : k;
            const opt = q?.options?.find((o) => o.value === v);
            return (
              <div key={k} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd>{opt ? (locale === "fr" ? opt.fr : opt.nl) : v}</dd>
              </div>
            );
          })}
          <dt className="text-muted">{t("dash.customer")}</dt>
          <dd>
            {req.contactName.split(" ")[0]} <span className="text-muted">— {t("dash.customer_contact_hidden")}</span>
          </dd>
        </dl>
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((ph) => (
              <li key={ph.id}>
                <a href={`/files/${ph.path}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/files/${ph.path}`} alt="" className="size-24 rounded-lg border border-line object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="space-y-3">
        <SectionTitle>{mine ? t("dash.my_proposals") : t("dash.send_proposal")}</SectionTitle>
        {mine ? (
          <ProposalCard proposal={mine} provider={provider} stats={undefined} locale={locale} t={t} status={<Badge tone={mine.status === "accepted" ? "ok" : "neutral"}>{t(`dash.proposal_status_${mine.status}` as MessageKey)}</Badge>} footer={mine.status === "sent" && isOpen ? <WithdrawProposal locale={locale} proposalId={mine.id} labels={labels} /> : undefined} />
        ) : isOpen && provider.status === "active" ? (
          <Card>
            <ProposalForm locale={locale} requestId={id} labels={labels} fee={{ bps: fee.feeBps, minCents: fee.feeMinCents, bpsLabel: formatBps(fee.feeBps), minLabel: formatCents(fee.feeMinCents, locale) }} defaults={{ hourly: provider.hourlyRateCents ? (provider.hourlyRateCents / 100).toFixed(2) : "", travel: (provider.travelFeeCents / 100).toFixed(2) }} suggestedStart={suggestedStart} />
          </Card>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionTitle>{t("mine.messages")}</SectionTitle>
        <Card>
          <ProviderThread locale={locale} requestId={id} messages={thread.map((m) => ({ id: m.id, senderRole: m.senderRole, body: m.body, at: formatDateTime(m.createdAt, locale) }))} labels={labels} disabled={!isOpen && req.status !== "booked"} />
        </Card>
      </section>
    </div>
  );
}
