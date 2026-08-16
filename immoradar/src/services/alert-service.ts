/**
 * Alert service: turns high-scoring opportunities into persisted, deduplicated
 * alerts and delivers them via Telegram (when configured). Dedupe is enforced
 * both in code and by the (agencyId, dedupeKey) unique constraint.
 */

import type { AlertKind, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { telegramClient, type TelegramClient } from "@/notifications/telegram";

export interface AlertDispatchResult {
  agencyId: string;
  created: number;
  sent: number;
  suppressed: number;
}

interface OpportunityForAlert {
  id: string;
  type: string;
  origin: string;
  contactId: string | null;
  property: { address: string | null; city: string | null } | null;
  listing: { currentPrice: number | null } | null;
  contact: { firstName: string | null; lastName: string | null; contactType: string } | null;
  scores: { total: number; reasons: unknown }[];
  detectedAt: Date;
}

export class AlertService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly telegram: TelegramClient = telegramClient(),
  ) {}

  /** Scan NEW high-score opportunities for one agency and dispatch alerts. */
  async dispatchInstantAlerts(agencyId: string, now = new Date()): Promise<AlertDispatchResult> {
    const agency = await this.db.agency.findUniqueOrThrow({ where: { id: agencyId } });
    const result: AlertDispatchResult = { agencyId, created: 0, sent: 0, suppressed: 0 };
    if (!agency.instantAlertsEnabled) return result;

    const opportunities = (await this.db.opportunity.findMany({
      where: {
        agencyId,
        status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] },
        scores: { some: { total: { gte: agency.minAlertScore } } },
      },
      include: {
        property: { select: { address: true, city: true } },
        listing: { select: { currentPrice: true } },
        contact: { select: { firstName: true, lastName: true, contactType: true } },
        scores: { orderBy: { computedAt: "desc" }, take: 1, select: { total: true, reasons: true } },
      },
      orderBy: { detectedAt: "desc" },
      take: 20,
    })) as unknown as OpportunityForAlert[];

    for (const opp of opportunities) {
      const score = opp.scores[0]?.total ?? 0;
      if (score < agency.minAlertScore) continue;

      const isCross = opp.origin === "CROSS" && opp.contactId !== null;
      const kind: AlertKind = isCross ? "CRM_MARKET_MATCH" : "HOT_OPPORTUNITY";
      const dedupeKey = `${kind}:${opp.id}`;

      const existing = await this.db.alert.findUnique({
        where: { agencyId_dedupeKey: { agencyId, dedupeKey } },
      });
      if (existing) {
        result.suppressed++;
        continue;
      }

      const { title, body } = formatAlert(opp, score, isCross);
      const alert = await this.db.alert.create({
        data: {
          agencyId,
          opportunityId: opp.id,
          kind,
          channel: "TELEGRAM",
          dedupeKey,
          title,
          body,
          status: "PENDING",
        },
      });
      result.created++;

      if (agency.telegramChatId) {
        const send = await this.telegram.sendMessage(agency.telegramChatId, `${title}\n\n${body}`);
        await this.db.alert.update({
          where: { id: alert.id },
          data: {
            status: send.ok ? "SENT" : "FAILED",
            sentAt: send.delivered ? now : null,
            error: send.error,
          },
        });
        if (send.ok) result.sent++;
      } else {
        // No chat configured: alert remains available in-app
        await this.db.alert.update({ where: { id: alert.id }, data: { status: "SENT", sentAt: now } });
        result.sent++;
      }
    }

    logger.info("alerts.dispatched", { ...result });
    return result;
  }
}

function formatAlert(
  opp: OpportunityForAlert,
  score: number,
  isCross: boolean,
): { title: string; body: string } {
  const city = opp.property?.city ? capitalize(opp.property.city) : "Unknown location";
  const price = opp.listing?.currentPrice
    ? `€${opp.listing.currentPrice.toLocaleString("nl-BE")}`
    : "";
  const contactName = opp.contact
    ? [opp.contact.firstName, opp.contact.lastName].filter(Boolean).join(" ")
    : null;

  const title = isCross
    ? "🚨 HIGH PRIORITY SELLER OPPORTUNITY"
    : "🔥 HOT SELLER OPPORTUNITY";

  const lines: string[] = [];
  lines.push(`${city}${price ? `\n${price}` : ""}`);
  lines.push("");
  lines.push(`Signal: ${opp.type.replaceAll("_", " ")}`);
  if (isCross && contactName) {
    lines.push("");
    lines.push("CRM MATCH FOUND");
    lines.push(contactName);
    lines.push(`Relationship: ${opp.contact!.contactType.replaceAll("_", " ").toLowerCase()}`);
  }
  lines.push("");
  lines.push(`Opportunity Score: ${score}/100`);
  const reasons = Array.isArray(opp.scores[0]?.reasons) ? (opp.scores[0]!.reasons as string[]) : [];
  if (reasons.length > 0) {
    lines.push("");
    lines.push(`Reason: ${reasons.slice(0, 3).join(" + ")}`);
  }
  return { title, body: lines.join("\n") };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
