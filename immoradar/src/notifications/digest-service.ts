import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { OPEN_STATUSES, categoryFor } from "@/domain/opportunity/types";
import { createAndSendAlert, opportunityMessageInput } from "./alert-service";
import { morningDigestMessage } from "./messages";
import type { AlertTransport } from "./telegram";

const log = createLogger({ component: "digest" });

export interface DigestOptions {
  now?: Date;
  transport?: AlertTransport;
  /** Ignore the configured digest hour (manual trigger). */
  force?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  NEW_FSBO: "New FSBO",
  CRM_MARKET_MATCH: "CRM + FSBO Match",
  STALE: "Stale Sellers",
  PRICE_DROP: "Price Drops",
  RELIST: "Relisted Properties",
  AGENCY_TO_PRIVATE: "Agency → Private",
  DORMANT_VALUATION_LEAD: "Dormant Valuation Leads",
  LEADREVIVE: "LeadRevive Leads",
};

function localHour(date: Date, timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(date));
  } catch {
    return date.getUTCHours();
  }
}

export interface DigestData {
  total: number;
  counts: Array<{ label: string; count: number }>;
  topId: string | null;
}

/** Aggregate the opportunities that need attention for an agency (optionally one agent). */
export async function buildDigestData(db: Db, agencyId: string, userId: string | null, now: Date): Promise<DigestData> {
  const opps = await db.opportunity.findMany({
    where: {
      agencyId,
      status: { in: OPEN_STATUSES.filter((s) => s !== "CONTACTED" && s !== "INTERESTED" && s !== "VALUATION_BOOKED" && s !== "MANDATE_PROPOSED") },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      ...(userId ? { OR: [{ assignedUserId: userId }, { assignedUserId: null }] } : {}),
    },
    orderBy: { score: "desc" },
    select: { id: true, type: true, crmMatched: true, score: true },
  });
  const counts = new Map<string, number>();
  for (const o of opps) {
    let key: string;
    if (o.crmMatched && o.type !== "DORMANT_VALUATION_LEAD") key = "CRM_MARKET_MATCH";
    else if (o.type === "NEW_FSBO") key = "NEW_FSBO";
    else if (o.type === "AGENCY_TO_PRIVATE") key = "AGENCY_TO_PRIVATE";
    else if (o.type === "DORMANT_VALUATION_LEAD") key = "DORMANT_VALUATION_LEAD";
    else key = categoryFor(o.type, false);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const order = ["NEW_FSBO", "CRM_MARKET_MATCH", "STALE", "PRICE_DROP", "RELIST", "AGENCY_TO_PRIVATE", "DORMANT_VALUATION_LEAD", "LEADREVIVE"];
  return {
    total: opps.length,
    counts: order.filter((k) => counts.has(k)).map((k) => ({ label: CATEGORY_LABELS[k] ?? k, count: counts.get(k) ?? 0 })),
    topId: opps[0]?.id ?? null,
  };
}

export async function buildDigestText(db: Db, agencyId: string, recipient: { userId: string | null; name: string }, now: Date): Promise<string> {
  const data = await buildDigestData(db, agencyId, recipient.userId, now);
  const top = data.topId ? await opportunityMessageInput(db, data.topId, now) : null;
  return morningDigestMessage({ recipientName: recipient.name, counts: data.counts, total: data.total, top, appUrl: getEnv().APP_URL });
}

/** Send the morning brief to every agency whose configured hour matches `now` (or all when forced). */
export async function sendMorningDigests(db: Db, opts: DigestOptions = {}): Promise<{ agencies: number; sent: number; skipped: number }> {
  const now = opts.now ?? new Date();
  const agencies = await db.agency.findMany({ where: { isActive: true, digestEnabled: true }, include: { users: { where: { isActive: true } }, alertRules: { where: { type: "MORNING_DIGEST" } } } });
  const result = { agencies: 0, sent: 0, skipped: 0 };
  const dayKey = now.toISOString().slice(0, 10);
  for (const agency of agencies) {
    const rule = agency.alertRules[0];
    if (rule && !rule.enabled) continue;
    if (!opts.force && localHour(now, agency.timezone) !== agency.digestHourLocal) continue;
    result.agencies++;
    const recipients = agency.users.filter((u) => u.telegramChatId);
    if (recipients.length) {
      for (const user of recipients) {
        const text = await buildDigestText(db, agency.id, { userId: user.id, name: user.name.split(" ")[0] ?? user.name }, now);
        const r = await createAndSendAlert(db, { agencyId: agency.id, opportunityId: null, userId: user.id, type: "MORNING_DIGEST", dedupeKey: `digest:${agency.id}:${user.id}:${dayKey}`, title: `Morning brief ${dayKey}`, body: text, recipient: user.telegramChatId }, { now, transport: opts.transport });
        if (r.sent) result.sent++;
        else result.skipped++;
      }
    } else {
      const text = await buildDigestText(db, agency.id, { userId: null, name: agency.name }, now);
      const r = await createAndSendAlert(db, { agencyId: agency.id, opportunityId: null, userId: null, type: "MORNING_DIGEST", dedupeKey: `digest:${agency.id}:agency:${dayKey}`, title: `Morning brief ${dayKey}`, body: text, recipient: agency.telegramChatId }, { now, transport: opts.transport });
      if (r.sent) result.sent++;
      else result.skipped++;
    }
  }
  log.info("morning digests processed", result);
  return result;
}
