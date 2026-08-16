/**
 * Job: full intelligence pipeline — collect, ingest, generate opportunities
 * for every agency, scan LeadRevive, dispatch instant alerts.
 * Usage: npm run jobs:pipeline [-- --scene=N]
 */

import { runCollectors } from "@/collectors/runner";
import { demoCollectors } from "@/collectors/fixtures/demo-fixtures";
import { IngestionService } from "@/ingestion/ingestion-service";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AlertService } from "@/services/alert-service";
import { LeadReviveService } from "@/services/leadrevive-service";
import { OpportunityService } from "@/services/opportunity-service";

async function main() {
  const sceneArg = process.argv.find((a) => a.startsWith("--scene="));
  const scene = sceneArg ? parseInt(sceneArg.split("=")[1] ?? "0", 10) : 0;

  // 1. Collect + ingest (shared market data)
  const results = await runCollectors(demoCollectors(scene));
  const ingestion = new IngestionService(prisma);
  for (const result of results) {
    const stats = await ingestion.processCollectorRun(result);
    logger.info("job.pipeline.ingested", { ...stats });
  }

  // 2. Per-agency intelligence
  const agencies = await prisma.agency.findMany({ select: { id: true, slug: true } });
  const opportunities = new OpportunityService(prisma);
  const leadRevive = new LeadReviveService(prisma);
  const alerts = new AlertService(prisma);

  for (const agency of agencies) {
    const gen = await opportunities.generateForAgency(agency.id);
    const revive = await leadRevive.scanAgency(agency.id);
    const dispatched = await alerts.dispatchInstantAlerts(agency.id);
    logger.info("job.pipeline.agency_done", {
      agency: agency.slug,
      marketCreated: gen.created,
      marketUpdated: gen.updated,
      crossMatches: gen.crossMatches,
      dormantCreated: revive.created,
      alertsCreated: dispatched.created,
    });
  }
}

main()
  .catch((err) => {
    logger.error("job.pipeline.failed", { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
