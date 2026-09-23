import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import type { AlertType, Prisma } from "@/generated/prisma/client";
import { categoryFor } from "@/domain/opportunity/types";
import { relationshipLabelFor } from "@/services/contact-labels";
import { hotOpportunityMessage, type OpportunityMessageInput } from "./messages";
import { defaultTransport, type AlertTransport } from "./telegram";

const log = createLogger({ component: "alerts" });

export interface AlertOptions {
  now?: Date;
  transport?: AlertTransport;
}

export async function opportunityMessageInput(db: Db, opportunityId: string, now: Date): Promise<OpportunityMessageInput | null> {
  const o = await db.opportunity.findUnique({
    where: { id: opportunityId },
    include: { property: true, listing: { select: { currentPrice: true } }, contact: { include: { relationships: true } }, assignedUser: { select: { name: true } } },
  });
  if (!o) return null;
  const reasons = ((o.scoreReasons as Array<{ label: string }> | null) ?? []).map((r) => r.label);
  return {
    id: o.id,
    headline: o.headline,
    score: o.score,
    type: o.type,
    place: o.property?.municipality ?? o.property?.city ?? o.contact?.city ?? null,
    price: o.listing?.currentPrice ?? o.priceAtDetection,
    detectedAt: o.detectedAt,
    crmMatched: o.crmMatched,
    contactName: o.contact ? [o.contact.firstName, o.contact.lastName].filter(Boolean).join(" ") || null : null,
    relationshipLabel: o.contact ? relationshipLabelFor(o.contact) : null,
    assignedName: o.assignedUser?.name ?? null,
    reasons,
    appUrl: getEnv().APP_URL,
    now,
  };
}

/**
 * Create + send an alert exactly once per dedupe key. Alert history is persisted
 * regardless of delivery outcome so that retries never duplicate messages.
 */
export async function createAndSendAlert(
  db: Db,
  input: { agencyId: string; opportunityId: string | null; userId: string | null; type: AlertType; dedupeKey: string; title: string; body: string; recipient: string | null; payload?: Prisma.InputJsonValue },
  opts: AlertOptions = {},
): Promise<{ sent: boolean; alertId: string | null; duplicate: boolean }> {
  const existing = await db.alert.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) return { sent: false, alertId: existing.id, duplicate: true };
  const transport = opts.transport ?? defaultTransport();
  const alert = await db.alert.create({
    data: { agencyId: input.agencyId, opportunityId: input.opportunityId, userId: input.userId, type: input.type, channel: input.recipient ? "TELEGRAM" : "IN_APP", status: "PENDING", dedupeKey: input.dedupeKey, title: input.title, body: input.body, recipient: input.recipient, payload: input.payload },
  });
  if (!input.recipient) {
    await db.alert.update({ where: { id: alert.id }, data: { status: "SKIPPED", error: "No Telegram chat configured" } });
    return { sent: false, alertId: alert.id, duplicate: false };
  }
  const res = await transport.send(input.recipient, input.body);
  await db.alert.update({ where: { id: alert.id }, data: { status: res.ok ? "SENT" : "FAILED", sentAt: res.ok ? new Date() : null, error: res.ok ? null : res.error } });
  if (input.opportunityId) {
    await db.opportunityActivity.create({ data: { opportunityId: input.opportunityId, agencyId: input.agencyId, userId: null, type: "ALERT_SENT", note: `${input.type} via ${transport.name}${res.ok ? "" : " (failed)"}` } });
  }
  if (!res.ok) log.warn("alert delivery failed", { alertId: alert.id, type: input.type, error: res.error });
  return { sent: res.ok, alertId: alert.id, duplicate: false };
}

/**
 * Decide which instant alerts an opportunity deserves and send them.
 * - HOT_OPPORTUNITY when score ≥ agency/rule threshold
 * - CRM_MARKET_MATCH when a market signal matched a CRM contact
 * Returns the number of alerts actually delivered.
 */
export async function evaluateOpportunityAlerts(db: Db, opportunityId: string, opts: AlertOptions = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, include: { agency: { include: { alertRules: true } }, assignedUser: { select: { id: true, telegramChatId: true } } } });
  if (!opp || opp.engine !== "IMMORADAR") return 0;
  if (["DISMISSED", "LOST", "MANDATE_WON"].includes(opp.status)) return 0;
  const agency = opp.agency;
  const rules = agency.alertRules;
  const hotRule = rules.find((r) => r.type === "HOT_OPPORTUNITY");
  const crmRule = rules.find((r) => r.type === "CRM_MARKET_MATCH");
  const hotEnabled = hotRule ? hotRule.enabled : true;
  const crmEnabled = crmRule ? crmRule.enabled : true;
  const minScore = hotRule?.minScore ?? agency.alertMinScore;
  const recipient = opp.assignedUser?.telegramChatId ?? agency.telegramChatId;
  const message = await opportunityMessageInput(db, opp.id, now);
  if (!message) return 0;
  const text = hotOpportunityMessage(message);
  let sent = 0;

  // One instant alert per opportunity. The only reason for a second one is a
  // CRM relationship discovered after a plain hot alert already went out.
  const previous = await db.alert.findMany({ where: { opportunityId: opp.id, type: { in: ["HOT_OPPORTUNITY", "CRM_MARKET_MATCH"] } }, select: { type: true } });
  const hadCrmAlert = previous.some((a) => a.type === "CRM_MARKET_MATCH");
  const hadHotAlert = previous.some((a) => a.type === "HOT_OPPORTUNITY");
  if (hadCrmAlert) return 0;

  if (crmEnabled && opp.crmMatched) {
    const r = await createAndSendAlert(db, { agencyId: agency.id, opportunityId: opp.id, userId: opp.assignedUser?.id ?? null, type: "CRM_MARKET_MATCH", dedupeKey: `crm-match:${opp.id}`, title: `CRM match: ${message.headline}`, body: text, recipient, payload: { score: opp.score, category: categoryFor(opp.type, opp.crmMatched) } }, { ...opts, now });
    if (r.sent) sent++;
    return sent;
  }
  if (hotEnabled && !hadHotAlert && opp.score >= minScore) {
    const r = await createAndSendAlert(db, { agencyId: agency.id, opportunityId: opp.id, userId: opp.assignedUser?.id ?? null, type: "HOT_OPPORTUNITY", dedupeKey: `hot:${opp.id}`, title: `Hot opportunity: ${message.headline}`, body: text, recipient, payload: { score: opp.score, minScore } }, { ...opts, now });
    if (r.sent) sent++;
  }
  return sent;
}
