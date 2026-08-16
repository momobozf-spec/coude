/**
 * Job: run all fixture collectors once and ingest results.
 * Usage: npm run jobs:collect [-- --scene=N]
 */

import { runCollectors } from "@/collectors/runner";
import { demoCollectors } from "@/collectors/fixtures/demo-fixtures";
import { IngestionService } from "@/ingestion/ingestion-service";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

async function main() {
  const sceneArg = process.argv.find((a) => a.startsWith("--scene="));
  const scene = sceneArg ? parseInt(sceneArg.split("=")[1] ?? "0", 10) : 0;

  const collectors = demoCollectors(scene);
  const results = await runCollectors(collectors);
  const ingestion = new IngestionService(prisma);

  for (const result of results) {
    const stats = await ingestion.processCollectorRun(result);
    logger.info("job.collect.source_done", { ...stats });
  }
}

main()
  .catch((err) => {
    logger.error("job.collect.failed", { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
