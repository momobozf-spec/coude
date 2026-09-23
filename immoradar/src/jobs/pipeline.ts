import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { getCollector } from "@/collectors/registry";
import { runCollector } from "@/collectors/runner";
import { ingestListings, type IngestResult } from "@/ingestion/ingest-listings";
import { processMarketEvents, type ProcessEventsResult } from "@/services/opportunity-engine";
import { linkRelationshipsToProperties } from "@/services/leadrevive-import";
import { detectDormantOpportunitiesForAllAgencies, type DormantRunResult } from "@/services/leadrevive-engine";
import { sendMorningDigests } from "@/notifications/digest-service";
import type { AlertTransport } from "@/notifications/telegram";
import type { ListingCollector } from "@/collectors/types";

const log = createLogger({ component: "jobs" });

export interface CollectJobResult {
  runs: Array<{ source: string; status: string; listings: number; ingest?: IngestResult; error?: string }>;
  events: ProcessEventsResult;
}

export interface PipelineOptions {
  now?: Date;
  transport?: AlertTransport;
  collectors?: ListingCollector[];
  sleep?: (ms: number) => Promise<void>;
}

/** Collect from every enabled collector, ingest, then turn events into opportunities. */
export async function runCollectJob(db: Db, opts: PipelineOptions = {}): Promise<CollectJobResult> {
  const now = opts.now ?? new Date();
  const keys = getEnv().COLLECTORS_ENABLED.split(",").map((k) => k.trim()).filter(Boolean);
  const collectors = opts.collectors ?? keys.map((k) => getCollector(k)).filter((c): c is ListingCollector => !!c);
  const runs: CollectJobResult["runs"] = [];
  for (const collector of collectors) {
    // Failure isolation: one broken source never blocks the others.
    try {
      const run = await runCollector(db, collector, { now, sleep: opts.sleep });
      if (run.status !== "SUCCESS") {
        runs.push({ source: collector.source, status: run.status, listings: 0, error: run.error });
        continue;
      }
      const ingest = await ingestListings(db, run.sourceId, run.runId, run.listings, { now });
      runs.push({ source: collector.source, status: run.status, listings: run.listings.length, ingest });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("collector pipeline failed", { source: collector.source, error: message });
      runs.push({ source: collector.source, status: "FAILED", listings: 0, error: message });
    }
  }
  await linkRelationshipsToProperties(db);
  // Drain the event queue in batches so a large backfill is fully processed.
  const events: ProcessEventsResult = { eventsProcessed: 0, opportunitiesCreated: 0, opportunitiesUpdated: 0, crmMatches: 0, alertsSent: 0 };
  for (let i = 0; i < 50; i++) {
    const batch = await processMarketEvents(db, { now, transport: opts.transport });
    for (const k of Object.keys(events) as Array<keyof ProcessEventsResult>) events[k] += batch[k];
    if (batch.eventsProcessed === 0) break;
  }
  return { runs, events };
}

export async function runLeadReviveJob(db: Db, opts: PipelineOptions = {}): Promise<DormantRunResult[]> {
  return detectDormantOpportunitiesForAllAgencies(db, opts.now ?? new Date());
}

export async function runDigestJob(db: Db, opts: PipelineOptions & { force?: boolean } = {}) {
  return sendMorningDigests(db, { now: opts.now, transport: opts.transport, force: opts.force });
}

/** Apply configured CRM retention: soft-delete contacts untouched for longer than the agency's retention window. */
export async function runRetentionJob(db: Db, now = new Date()): Promise<{ agencies: number; contactsDeleted: number; sessionsDeleted: number }> {
  const agencies = await db.agency.findMany({ where: { crmRetentionDays: { not: null } }, select: { id: true, crmRetentionDays: true } });
  let contactsDeleted = 0;
  for (const a of agencies) {
    const cutoff = new Date(now.getTime() - (a.crmRetentionDays ?? 0) * 86400000);
    const r = await db.crmContact.updateMany({ where: { agencyId: a.id, deletedAt: null, updatedAt: { lt: cutoff }, OR: [{ lastContactAt: null }, { lastContactAt: { lt: cutoff } }], opportunities: { none: { status: { in: ["NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "INTERESTED", "VALUATION_BOOKED", "MANDATE_PROPOSED"] } } } }, data: { deletedAt: now } });
    contactsDeleted += r.count;
  }
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return { agencies: agencies.length, contactsDeleted, sessionsDeleted: sessions.count };
}
