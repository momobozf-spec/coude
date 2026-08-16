/**
 * Morning opportunity brief: per-agency daily digest of opportunities that
 * need attention, delivered via Telegram and persisted as an alert.
 * Deduplicated per (agency, day).
 */

import type { PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { telegramClient, type TelegramClient } from "@/notifications/telegram";

const TYPE_LABELS: Record<string, string> = {
  NEW_FSBO: "New FSBO",
  STALE_FSBO: "Stale Seller",
  PRIVATE_PRICE_DROP: "Price Drop",
  PRIVATE_MULTIPLE_PRICE_DROP: "Multiple Price Drops",
  PRIVATE_RELIST: "Relisted Property",
  AGENCY_TO_PRIVATE: "Agency → Private",
  DORMANT_VALUATION_LEAD: "Dormant Valuation Lead",
  FORMER_SELLER_PROSPECT: "Former Seller Prospect",
  FORMER_CLIENT: "Former Client",
  OLD_BUYER: "Old Buyer",
  LOST_MANDATE: "Lost Mandate",
  UNCONTACTED_LEAD: "Uncontacted Lead",
  CRM_MARKET_MATCH: "CRM + Market Match",
};

export class DigestService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly telegram: TelegramClient = telegramClient(),
  ) {}

  /** Build and send the morning brief for one agency. Returns false when deduped. */
  async sendMorningBrief(agencyId: string, now = new Date()): Promise<boolean> {
    const agency = await this.db.agency.findUniqueOrThrow({ where: { id: agencyId } });
    if (!agency.digestEnabled) return false;

    const day = now.toISOString().slice(0, 10);
    const dedupeKey = `DIGEST:${day}`;
    const existing = await this.db.alert.findUnique({
      where: { agencyId_dedupeKey: { agencyId, dedupeKey } },
    });
    if (existing) return false;

    const opportunities = await this.db.opportunity.findMany({
      where: { agencyId, status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] } },
      include: {
        property: { select: { city: true } },
        listing: { select: { currentPrice: true } },
        scores: { orderBy: { computedAt: "desc" }, take: 1, select: { total: true, reasons: true } },
        assignments: {
          where: { active: true },
          take: 1,
          include: { assignedTo: { select: { firstName: true } } },
        },
      },
    });

    const ranked = opportunities
      .map((o) => ({ opp: o, score: o.scores[0]?.total ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const counts = new Map<string, number>();
    for (const { opp } of ranked) {
      const label = TYPE_LABELS[opp.type] ?? opp.type;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const firstAgent = await this.db.user.findFirst({
      where: { agencyId, role: "AGENT", isActive: true },
      select: { firstName: true },
    });
    const greetName = (firstAgent?.firstName ?? "team").toUpperCase();

    const lines: string[] = [];
    lines.push(`GOOD MORNING ${greetName}`);
    lines.push("");
    lines.push(`${ranked.length} ${ranked.length === 1 ? "opportunity needs" : "opportunities need"} attention`);
    lines.push("");
    for (const [label, count] of counts) {
      lines.push(`${count} ${label}`);
    }

    const top = ranked[0];
    if (top) {
      lines.push("");
      lines.push("TOP OPPORTUNITY");
      lines.push("");
      if (top.opp.property?.city) lines.push(capitalize(top.opp.property.city));
      if (top.opp.listing?.currentPrice) {
        lines.push(`€${top.opp.listing.currentPrice.toLocaleString("nl-BE")}`);
      }
      lines.push("");
      lines.push(`Score: ${top.score}`);
      const reasons = Array.isArray(top.opp.scores[0]?.reasons)
        ? (top.opp.scores[0]!.reasons as string[])
        : [];
      if (reasons.length > 0) {
        lines.push("");
        lines.push(reasons.slice(0, 2).join("\n+\n"));
      }
    }

    const body = lines.join("\n");
    const alert = await this.db.alert.create({
      data: {
        agencyId,
        kind: "MORNING_DIGEST",
        channel: "TELEGRAM",
        dedupeKey,
        title: "☀️ Morning Opportunity Brief",
        body,
        status: "PENDING",
      },
    });

    if (agency.telegramChatId) {
      const send = await this.telegram.sendMessage(agency.telegramChatId, body);
      await this.db.alert.update({
        where: { id: alert.id },
        data: { status: send.ok ? "SENT" : "FAILED", sentAt: send.delivered ? now : null, error: send.error },
      });
    } else {
      await this.db.alert.update({ where: { id: alert.id }, data: { status: "SENT", sentAt: now } });
    }

    logger.info("digest.sent", { agencyId, opportunities: ranked.length });
    return true;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
